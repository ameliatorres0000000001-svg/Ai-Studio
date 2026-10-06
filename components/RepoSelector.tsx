"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { GitHubRepo, Workspace } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { Button, Spinner, ErrorState, EmptyState } from "@/components/ui";

export function RepoSelector({
  onSelect,
}: {
  onSelect: (ws: Workspace) => void;
}) {
  const { t, lang } = useLang();
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
          <h3>{lang === "kh" ? "ឃ្លាំងសម្ងាត់ GitHub" : "GitHub Repositories"}</h3>
        </div>
        <EmptyState
          icon="◉"
          title={lang === "kh" ? "ភ្ជាប់គណនី GitHub" : "Connect your GitHub account"}
          description={lang === "kh" ? "ផ្ទុកឃ្លាំងសម្ងាត់របស់អ្នកដើម្បីជ្រើសរើសមួយឲ្យ Claude ធ្វើការ។" : "Load your repositories to select one for Claude to work on."}
          action={<Button onClick={loadRepos}>{t("loadRepos")}</Button>}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-header">
          <h3>{lang === "kh" ? "ឃ្លាំងសម្ងាត់ GitHub" : "GitHub Repositories"}</h3>
        </div>
        <Spinner label={t("loadingRepos")} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel">
        <div className="panel-header">
          <h3>{lang === "kh" ? "ឃ្លាំងសម្ងាត់ GitHub" : "GitHub Repositories"}</h3>
        </div>
        <ErrorState message={error} />
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" onClick={loadRepos}>{t("tryAgain")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>{lang === "kh" ? "ឃ្លាំងសម្ងាត់ GitHub" : "GitHub Repositories"}</h3>
        <Button variant="secondary" onClick={loadRepos} className="btn-sm">
          {t("refresh")}
        </Button>
      </div>
      <p style={{ marginBottom: 14 }}>
        {lang === "kh" ? "ជ្រើសរើសឃ្លាំងសម្ងាត់ដើម្បី clone និងគ្រប់គ្រងជាមួយ Claude។" : "Select a repository to clone and manage with Claude."}
      </p>
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
              <small>{repo.private ? t("private") : t("public")}</small>
            </div>
            {syncing === repo.full_name && (
              <small style={{ color: "var(--info)" }}>{t("cloning")}</small>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
