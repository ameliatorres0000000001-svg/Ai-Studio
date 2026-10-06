"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { GitHubRepo, Workspace } from "@/lib/types";

export function RepoSelector({
  onSelect,
}: {
  onSelect: (ws: Workspace) => void;
}) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function loadRepos() {
    setLoading(true);
    setError(null);
    try {
      const { repos } = await api.githubRepos();
      setRepos(repos);
      setLoaded(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectRepo(repo: GitHubRepo) {
    setSyncing(repo.full_name);
    setError(null);
    try {
      const { workspace } = await api.syncRepo(repo.full_name);
      onSelect(workspace);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(null);
    }
  }

  return (
    <div className="panel">
      <h3>GitHub Repositories</h3>
      <p>Select a repository to clone and manage with Claude.</p>
      {!loaded && !loading && (
        <button className="wide" onClick={loadRepos}>
          Load Repositories →
        </button>
      )}
      {loading && <p>Loading repositories...</p>}
      {error && (
        <p style={{ color: "#ff6b6b" }}>Error: {error}</p>
      )}
      {loaded && (
        <>
          <button
            className="wide"
            onClick={loadRepos}
            style={{ marginBottom: "10px", opacity: 0.7 }}
          >
            Refresh list
          </button>
          <div className="projectgrid">
            {repos.map((repo) => (
              <button
                key={repo.id}
                className="project"
                onClick={() => selectRepo(repo)}
                disabled={syncing !== null}
                style={{ opacity: syncing ? 0.5 : 1 }}
              >
                <i>◈</i>
                <b>{repo.name}</b>
                <small>{repo.full_name}</small>
                {repo.language && <em>{repo.language}</em>}
                <small>{repo.private ? "Private" : "Public"}</small>
                {syncing === repo.full_name && <small>Cloning...</small>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
