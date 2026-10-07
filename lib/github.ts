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
