"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { GitHubRepo, Workspace } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { Button, ErrorState, Spinner } from "@/components/ui";

function repoFullNameFromInput(value: string): string {
  const input = value.trim();
  const match = input.match(/(?:^|github\.com[:/])([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i);
  if (match) return `${match[1]}/${match[2].replace(/\.git$/i, "")}`;
  return input;
}

export function GitHubImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (workspace: Workspace) => void;
}) {
  const { lang } = useLang();
  const kh = lang === "kh";
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [repoInput, setRepoInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    api.githubRepos().then(({ repos }) => setRepos(repos)).catch((e) => {
      setRepos([]);
      setError(e.message);
    });
  }, [open]);

  if (!open) return null;

  async function importRepo(fullName: string) {
    const normalized = repoFullNameFromInput(fullName);
    setSyncing(normalized);
    setError(null);
    try {
      const { workspace } = await api.syncRepo(normalized);
      onImported(workspace);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(null);
    }
  }

  const canImport = !!repoFullNameFromInput(repoInput).includes("/") && !syncing;

  return (
    <div className="ws-modal-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ws-modal" role="dialog" aria-modal="true" aria-labelledby="github-import-title">
        <div className="ws-modal-head">
          <div>
            <span className="ws-eyebrow">{kh ? "ទុកជា server-managed" : "Server-managed import"}</span>
            <h2 id="github-import-title">{kh ? "នាំចូលពី GitHub" : "Import from GitHub"}</h2>
            <p>{kh ? "ជ្រើសរើសឃ្លាំងសម្ងាត់ដែល server អាចមើលឃើញ ឬបិទតាំង owner/repo URL។" : "Pick a repository visible to the server connection, or paste an owner/repo URL."}</p>
          </div>
          <button className="ws-icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        {error && <ErrorState message={error} />}
        {repos === null && !error && <Spinner label={kh ? "កំពុងផ្ទុកឃ្លាំងសម្ងាត់..." : "Loading repositories..."} />}

        {repos && repos.length > 0 && (
          <div className="ws-repo-list">
            {repos.slice(0, 8).map((repo) => (
              <button key={repo.id} className="ws-repo-row" onClick={() => importRepo(repo.full_name)} disabled={!!syncing}>
                <span className="ws-repo-icon">◈</span>
                <span className="ws-repo-copy">
                  <strong>{repo.full_name}</strong>
                  <small>{repo.private ? (kh ? "ឯកជន" : "Private") : (kh ? "សាធារណៈ" : "Public")} · {repo.default_branch}</small>
                </span>
                <span>{syncing === repo.full_name ? (kh ? "កំពុងនាំចូល..." : "Importing…") : kh ? "នាំចូល" : "Import"}</span>
              </button>
            ))}
          </div>
        )}

        <div className="ws-import-divider"><span>{kh ? "ឬបិទតាំង repo URL" : "or paste a repo URL"}</span></div>
        <form className="ws-import-form" onSubmit={(e) => { e.preventDefault(); if (canImport) void importRepo(repoInput); }}>
          <input
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="owner/repo or https://github.com/owner/repo"
            aria-label={kh ? "ឃ្លាំងសម្ងាត់ GitHub" : "GitHub repository"}
          />
          <Button type="submit" disabled={!canImport}>{kh ? "នាំចូល" : "Import"}</Button>
        </form>
        <p className="ws-footnote">{kh ? "ឃ្លាំងសម្ងាត់ឯកជនត្រូវការការចូលប្រើពី GitHub connection ដែលកំណត់លើ server។" : "Private repositories require access from the GitHub connection configured on the server."}</p>
      </div>
    </div>
  );
}
