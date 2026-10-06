import { Octokit } from "@octokit/rest";
import type { GitHubRepo } from "./types";

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
  const { data } = await octokit.rest.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 100,
    type: "owner",
  });
  return data.map((r) => ({
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
): Promise<{ default_branch: string; clone_url: string; full_name: string }> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.repos.get({ owner, repo });
  return {
    default_branch: data.default_branch,
    clone_url: data.clone_url,
    full_name: data.full_name,
  };
}

export function getCloneUrl(owner: string, repo: string): string {
  const token = process.env.GITHUB_ACCESS_TOKEN!;
  return `https://${token}@github.com/${owner}/${repo}.git`;
}
