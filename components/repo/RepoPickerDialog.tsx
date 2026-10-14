"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { GitHubRepo, Workspace } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { Button, Spinner, ErrorState } from "@/components/ui";
import { Dialog, Input, Badge } from "@/components/ui/primitives";
import { GitHubConnectCard } from "@/components/connectors/GitHubConnectCard";

export function RepoPickerDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (ws: Workspace) => void;
}) {
  const { lang } = useLang();
  const kh = lang === "kh";
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [connectRequired, setConnectRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filterPrivate, setFilterPrivate] = useState<"all" | "private" | "public">("all");
  const [selected, setSelected] = useState<GitHubRepo | null>(null);
  const [branches, setBranches] = useState<{ name: string }[]>([]);
  const [branch, setBranch] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setRepos(null);
    setError(null);
    setConnectRequired(false);
    api.githubRepos()
      .then(({ repos }) => setRepos(repos))
      .catch((e) => {
        setRepos([]);
        if (e?.data?.connectRequired || e?.data?.connectRequired === true) {
          setConnectRequired(true);
        } else {
          setError(e.message);
        }
      });
  }, [open]);

  useEffect(() => {
    if (!selected) return;
    setBranch(selected.default_branch);
    setBranches([]);
    api.githubBranches(selected.full_name)
      .then(({ branches }) => setBranches(branches))
      .catch(() => {});
  }, [selected]);

  const filtered = useMemo(() => {
    if (!repos) return [];
    const q = debounced.toLowerCase();
    return repos.filter((r) => {
      if (filterPrivate === "private" && !r.private) return false;
      if (filterPrivate === "public" && r.private) return false;
      if (q && !r.full_name.toLowerCase().includes(q) && !(r.description || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [repos, debounced, filterPrivate]);

  async function importRepo() {
    if (!selected || syncing) return;
    setSyncing(true);
    setError(null);
    try {
      const { workspace } = await api.syncRepo(selected.full_name, branch || undefined);
      onImported(workspace);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Dialog open={open} title={kh ? "នាំចូលពី GitHub" : "Import from GitHub"} onClose={onClose}>
      {connectRequired ? (
        <GitHubConnectCard />
      ) : (
        <>
          {error && <ErrorState message={error} />}
          {repos === null && !error && <Spinner label={kh ? "កំពុងផ្ទុកឃ្លាំងសម្ងាត់..." : "Loading repositories…"} />}

          {repos !== null && !selected && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <Input
                  placeholder={kh ? "ស្វែងរកឃ្លាំងសម្ងាត់..." : "Search repositories…"}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  aria-label={kh ? "ឯកជនភាព" : "Visibility"}
                  value={filterPrivate}
                  onChange={(e) => setFilterPrivate(e.target.value as any)}
                  style={{ minWidth: 110 }}
                >
                  <option value="all">{kh ? "ទាំងអស់" : "All"}</option>
                  <option value="private">{kh ? "ឯកជន" : "Private"}</option>
                  <option value="public">{kh ? "សាធារណៈ" : "Public"}</option>
                </select>
              </div>
              <div className="ws-repo-list" style={{ maxHeight: 380, overflowY: "auto" }}>
                {filtered.map((repo) => (
                  <button key={repo.id} className="ws-repo-row" onClick={() => setSelected(repo)}>
                    <span className="ws-repo-icon">◈</span>
                    <span className="ws-repo-copy">
                      <strong>{repo.full_name}</strong>
                      <small>
                        {repo.language ? `${repo.language} · ` : ""}
                        {repo.updated_at ? new Date(repo.updated_at).toLocaleDateString() : "—"}
                      </small>
                    </span>
                    {repo.private && <Badge tone="purple">{kh ? "ឯកជន" : "Private"}</Badge>}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="connector-meta">{kh ? "គ្មានឃ្លាំងសម្ងាត់ត្រូវនឹងលក្ខណៈ។" : "No repositories match."}</p>
                )}
              </div>
            </>
          )}

          {selected && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button className="email-reveal" style={{ margin: 0 }} onClick={() => setSelected(null)}>←</button>
                <strong>{selected.full_name}</strong>
                {selected.private && <Badge tone="purple">{kh ? "ឯកជន" : "Private"}</Badge>}
              </div>
              <label className="auth-field">
                <span>{kh ? "សាខា" : "Branch"}</span>
                <select value={branch} onChange={(e) => setBranch(e.target.value)}>
                  <option value={selected.default_branch}>{selected.default_branch}</option>
                  {branches.filter((b) => b.name !== selected.default_branch).map((b) => (
                    <option key={b.name} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </label>
              <Button onClick={importRepo} disabled={syncing}>
                {syncing ? (kh ? "កំពុងនាំចូល..." : "Importing…") : kh ? "នាំចូល" : "Import"}
              </Button>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}
