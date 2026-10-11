import { Octokit } from "@octokit/rest";
import type { GitHubRepo } from "./types";

// SERVER-ONLY. The token is read from the environment and never sent to the browser.

function getOctokit(): Octokit {
  const token = process.env.GITHUB_ACCESS_TOKEN;
  if (!token) {
    throw new Error("GITHUB_ACCESS_TOKEN is not configured");
  }
  return new Octokit({ auth: token });
}

export function isGitHubConfigured(): boolean {
  return !!process.env.GITHUB_ACCESS_TOKEN;
}

const REPO_PART_RE = /^[A-Za-z0-9_.-]{1,100}$/;

/** Validate and split "owner/repo". Returns null if malformed. */
export function parseRepoFullName(
  full: unknown
): { owner: string; repo: string } | null {
  if (typeof full !== "string") return null;
  const parts = full.split("/");
  if (parts.length !== 2) return null;
  const [owner, repo] = parts;
  if (!REPO_PART_RE.test(owner) || !REPO_PART_RE.test(repo)) return null;
  if (owner === "." || owner === ".." || repo === "." || repo === "..") return null;
  return { owner, repo };
}

/** Optional server-side allowlist: GITHUB_ALLOWED_REPOS="owner/a,owner/b" (or "owner/*"). */
export function isRepoAllowed(fullName: string): boolean {
  const raw = process.env.GITHUB_ALLOWED_REPOS || "";
  const list = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (list.length === 0) return true;
  const lower = fullName.toLowerCase();
  const owner = lower.split("/")[0];
  return list.some((p) => p === lower || p === `${owner}/*`);
}

export async function getAuthenticatedUser(): Promise<{
  login: string;
  avatar_url: string;
}> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.users.getAuthenticated();
  return { login: data.login, avatar_url: data.avatar_url };
}

export async function listRepositories(): Promise<GitHubRepo[]> {
  const octokit = getOctokit();
  const data = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    sort: "updated",
    per_page: 100,
    type: "owner",
  });
  return data
    .filter((r) => isRepoAllowed(r.full_name))
    .map((r) => ({
      id: r.id,
      full_name: r.full_name,
      name: r.name,
      default_branch: r.default_branch,
      private: r.private,
      description: r.description,
      html_url: r.html_url,
      updated_at: r.updated_at,
      language: r.language,
    }));
}

export async function getRepoInfo(
  owner: string,
  repo: string
): Promise<{
  default_branch: string;
  clone_url: string;
  full_name: string;
  description: string | null;
  language: string | null;
  private: boolean;
  html_url: string;
  can_push: boolean;
}> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.repos.get({ owner, repo });
  return {
    default_branch: data.default_branch,
    clone_url: data.clone_url,
    full_name: data.full_name,
    description: data.description,
    language: data.language,
    private: data.private,
    html_url: data.html_url,
    can_push: !!data.permissions?.push,
  };
}

/**
 * Credentialed clone/push URL. Use only for a single git operation and never
 * log it, store it, or return it. Errors must pass through redactSecrets().
 */
export function getCloneUrl(owner: string, repo: string): string {
  const token = process.env.GITHUB_ACCESS_TOKEN;
  if (!token) throw new Error("GITHUB_ACCESS_TOKEN is not configured");
  return `https://x-access-token:${encodeURIComponent(token)}@github.com/${owner}/${repo}.git`;
}

const REPO_NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;

/** Sanitizes a user-supplied bot name into a valid, URL-safe GitHub repo name. */
export function slugifyRepoName(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "my-bot";
}

/**
 * Creates a new, private repo for the authenticated user and uploads the given
 * files as its first commit. Used by the Bot Builder to hand a generated bot
 * project (template + BotSpec content) to the user as their own repo.
 */
export async function createRepoWithFiles(
  repoNameHint: string,
  files: { path: string; content: string }[]
): Promise<{ owner: string; repo: string; html_url: string }> {
  const octokit = getOctokit();
  const user = await getAuthenticatedUser();

  let name = slugifyRepoName(repoNameHint);
  if (!REPO_NAME_RE.test(name)) name = "my-bot";

  // Avoid colliding with an existing repo of the same name.
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await octokit.rest.repos.get({ owner: user.login, repo: name });
      name = `${slugifyRepoName(repoNameHint)}-${Math.random().toString(36).slice(2, 6)}`;
    } catch {
      break; // 404 means the name is free
    }
  }

  const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
    name,
    private: true,
    auto_init: false,
  });

  // Build a single commit from a tree of blobs (works for an empty repo, unlike
  // repeated "create or update file" calls which each need a parent commit).
  const blobs = await Promise.all(
    files.map(async (f) => {
      const { data } = await octokit.rest.git.createBlob({
        owner: repo.owner.login,
        repo: repo.name,
        content: Buffer.from(f.content, "utf-8").toString("base64"),
        encoding: "base64",
      });
      return { path: f.path, sha: data.sha };
    })
  );

  const { data: tree } = await octokit.rest.git.createTree({
    owner: repo.owner.login,
    repo: repo.name,
    tree: blobs.map((b) => ({ path: b.path, mode: "100644" as const, type: "blob" as const, sha: b.sha })),
  });

  const { data: commit } = await octokit.rest.git.createCommit({
    owner: repo.owner.login,
    repo: repo.name,
    message: "Initial commit (generated by Bot Builder)",
    tree: tree.sha,
  });

  await octokit.rest.git.createRef({
    owner: repo.owner.login,
    repo: repo.name,
    ref: `refs/heads/${repo.default_branch || "main"}`,
    sha: commit.sha,
  });

  return { owner: repo.owner.login, repo: repo.name, html_url: repo.html_url };
}
