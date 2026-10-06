"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { GitHubRepo, Workspace } from "@/lib/types";
import { Button, Spinner, ErrorState, EmptyState } from "@/components/ui";

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

  if (!loaded && !loading && !error) {
    return (
      <div className="panel">
        <div className="panel-header">
          <h3>GitHub Repositories</h3>
        </div>
        <EmptyState
          icon="◉"
          title="Connect your GitHub account"
          description="Load your repositories to select one for Claude to work on."
          action={<Button onClick={loadRepos}>Load Repositories</Button>}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-header">
          <h3>GitHub Repositories</h3>
        </div>
        <Spinner label="Loading repositories..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel">
        <div className="panel-header">
          <h3>GitHub Repositories</h3>
        </div>
        <ErrorState message={error} />
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" onClick={loadRepos}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>GitHub Repositories</h3>
        <Button variant="secondary" onClick={loadRepos} className="btn-sm">
          Refresh
        </Button>
      </div>
      <p style={{ marginBottom: 14 }}>
        Select a repository to clone and manage with Claude.
      </p>
      {error && <div style={{ marginBottom: 12 }}><ErrorState message={error} /></div>}
      <div className="projectgrid">
        {repos.map((repo) => (
          <button
            key={repo.id}
            className="project"
            onClick={() => selectRepo(repo)}
            disabled={syncing !== null}
          >
            <span className="project-icon">◈</span>
            <b>{repo.name}</b>
            <small>{repo.full_name}</small>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              {repo.language && <em>{repo.language}</em>}
              <small>{repo.private ? "Private" : "Public"}</small>
            </div>
            {syncing === repo.full_name && (
              <small style={{ color: "var(--info)" }}>Cloning...</small>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
