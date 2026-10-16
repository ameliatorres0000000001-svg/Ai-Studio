// SERVER-ONLY. Bot repos live under OUR GitHub account/org, written with the
// platform token (GITHUB_BOTS_TOKEN, else GITHUB_ACCESS_TOKEN). Users never get
// access; the platform agent maintains them. Endpoints: docs/BACKEND-BUILDER.md.

import { Octokit } from "@octokit/rest";
import { slugifyRepoName } from "@/lib/github";
import type { BuilderDeps, RepoFile } from "./types";

const BRANCH = "main";

function platformOctokit(): Octokit {
  const token = process.env.GITHUB_BOTS_TOKEN || process.env.GITHUB_ACCESS_TOKEN;
  if (!token) throw new Error("GITHUB_BOTS_TOKEN is not configured");
  return new Octokit({ auth: token });
}

function splitRepo(full: string): { owner: string; repo: string } {
  const [owner, repo] = full.split("/");
  if (!owner || !repo) throw new Error("Invalid repository name");
  return { owner, repo };
}

/** Only template-relative paths, nothing that could escape the repo or touch env/git files. */
function assertSafeFiles(files: RepoFile[]) {
  for (const f of files) {
    if (!f.path || f.path.startsWith("/") || f.path.includes("..") || f.path.includes("\\") || /(^|\/)\.env(\.|$)/.test(f.path) || f.path.startsWith(".git/")) {
      throw new Error(`Refusing to write unsafe path: ${f.path}`);
    }
  }
}

async function createRepo(octokit: Octokit, nameHint: string): Promise<{ owner: string; repo: string }> {
  const org = process.env.GITHUB_BOTS_ORG?.trim();
  const base = slugifyRepoName(nameHint);
  for (let attempt = 0; attempt < 5; attempt++) {
    const name = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      // auto_init gives the repo a first commit; the git data API rejects empty repos.
      const { data } = org
        ? await octokit.rest.repos.createInOrg({ org, name, private: true, auto_init: true, description: "TeleScripts generated bot (managed by the platform)" })
        : await octokit.rest.repos.createForAuthenticatedUser({ name, private: true, auto_init: true, description: "TeleScripts generated bot (managed by the platform)" });
      return { owner: data.owner.login, repo: data.name };
    } catch (e: any) {
      if (e?.status === 422) continue; // name taken
      throw new Error(`GitHub repo creation failed (${e?.status ?? "network"})`);
    }
  }
  throw new Error("Could not find a free repository name");
}

async function headCommit(octokit: Octokit, owner: string, repo: string): Promise<{ sha: string; tree: string } | null> {
  for (let i = 0; i < 5; i++) {
    try {
      const { data: ref } = await octokit.rest.git.getRef({ owner, repo, ref: `heads/${BRANCH}` });
      const { data: commit } = await octokit.rest.git.getCommit({ owner, repo, commit_sha: ref.object.sha });
      return { sha: commit.sha, tree: commit.tree.sha };
    } catch (e: any) {
      // A freshly auto-initialised repo can take a moment to expose its ref.
      if (e?.status !== 404 && e?.status !== 409) throw new Error(`GitHub read failed (${e?.status ?? "network"})`);
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return null;
}

export const githubAdapter: BuilderDeps["github"] = {
  async upsertRepo({ existing, nameHint, files, message }) {
    assertSafeFiles(files);
    const octokit = platformOctokit();
    const { owner, repo } = existing ? splitRepo(existing) : await createRepo(octokit, nameHint);
    const head = await headCommit(octokit, owner, repo);
    if (!head) throw new Error("Repository has no main branch yet");

    // Full tree (no base_tree) so the repo mirrors exactly the generated files.
    const { data: tree } = await octokit.rest.git.createTree({
      owner,
      repo,
      tree: files.map((f) => ({ path: f.path, mode: "100644" as const, type: "blob" as const, content: f.content })),
    });
    const fullName = `${owner}/${repo}`;
    const url = `https://github.com/${fullName}`;
    if (tree.sha === head.tree) return { fullName, url, commit: head.sha }; // nothing changed

    const { data: commit } = await octokit.rest.git.createCommit({ owner, repo, message, tree: tree.sha, parents: [head.sha] });
    await octokit.rest.git.updateRef({ owner, repo, ref: `heads/${BRANCH}`, sha: commit.sha });
    return { fullName, url, commit: commit.sha };
  },

  async readFiles(fullName, commitSha) {
    const octokit = platformOctokit();
    const { owner, repo } = splitRepo(fullName);
    const { data: commit } = await octokit.rest.git.getCommit({ owner, repo, commit_sha: commitSha });
    const { data: tree } = await octokit.rest.git.getTree({ owner, repo, tree_sha: commit.tree.sha, recursive: "true" });
    const blobs = tree.tree.filter((t) => t.type === "blob" && t.path && t.sha);
    if (blobs.length > 200) throw new Error("Repository has too many files to deploy inline");
    return Promise.all(
      blobs.map(async (b) => {
        const { data } = await octokit.rest.git.getBlob({ owner, repo, file_sha: b.sha! });
        const content = data.encoding === "base64" ? Buffer.from(data.content, "base64").toString("utf-8") : data.content;
        return { path: b.path!, content };
      })
    );
  },
};
