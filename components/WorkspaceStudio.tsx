"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase-client";
import type { TelegramStatus, Workspace } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { FileTree } from "@/components/FileTree";
import { CodeViewer } from "@/components/CodeViewer";
import { ClaudeChat } from "@/components/ClaudeChat";
import { DiffViewer } from "@/components/DiffViewer";
import { GitHubImportModal } from "@/components/GitHubImportModal";
import { Button, EmptyState, StatusBadge } from "@/components/ui";

interface OpenTab {
  path: string;
  content: string;
}

const ACTION_ITEMS: { icon: ReactNode; label: string; khLabel: string }[] = [
  { icon: "+", label: "New chat", khLabel: "សន្ទនាថ្មី" },
  { icon: "◇", label: "Projects", khLabel: "គម្រោង" },
  { icon: "✦", label: "Artifacts", khLabel: "Artifacts" },
  { icon: "⚙", label: "Customize", khLabel: "កែតម្រូវ" },
];

export function WorkspaceStudio() {
  const router = useRouter();
  const { t, lang, toggle } = useLang();
  const kh = lang === "kh";
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [fileRefresh, setFileRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [telegram, setTelegram] = useState<TelegramStatus | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployMessage, setDeployMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserEmail(data.session?.user.email ?? null));
    api.telegramStatus().then(setTelegram).catch(() => setTelegram(null));
    api.listWorkspaces().then(({ workspaces }) => {
      setWorkspaces(workspaces);
      if (workspaces[0]) setWorkspace(workspaces[0]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const selectWorkspace = useCallback((ws: Workspace) => {
    setWorkspace(ws);
    setOpenTabs([]);
    setActiveTab(0);
    api.listWorkspaces().then(({ workspaces }) => setWorkspaces(workspaces)).catch(() => {});
  }, []);

  function openFile(path: string, content: string) {
    setOpenTabs((current) => {
      const index = current.findIndex((tab) => tab.path === path);
      if (index >= 0) {
        setActiveTab(index);
        return current;
      }
      const next = [...current, { path, content }];
      setActiveTab(next.length - 1);
      return next;
    });
  }

  function closeFileTab(index: number) {
    setOpenTabs((current) => {
      const next = current.filter((_, i) => i !== index);
      if (activeTab >= next.length) setActiveTab(Math.max(0, next.length - 1));
      return next;
    });
  }

  async function deployPreview() {
    if (!workspace || deploying) return;
    setDeploying(true);
    setDeployMessage(null);
    try {
      const { deployment } = await api.deployVercel(workspace.id, "preview");
      setDeployMessage(deployment.url || (kh ? "ការបង្ហោះបានចាប់ផ្តើម" : "Deployment started"));
      if (deployment.url) setPreviewUrl(deployment.url);
    } catch (e: any) {
      setDeployMessage(e.message);
    } finally {
      setDeploying(false);
    }
  }

  const currentTab = openTabs[activeTab];
  const activeName = workspace?.repo_full_name.split("/")[1] ?? (kh ? "តំបន់ធ្វើការ" : "Workspace");

  return (
    <main className={`workspace-studio ${kh ? "lang-kh" : "lang-en"}`}>
      <aside className="ws-sidebar">
        <div className="ws-account">
          <button className="ws-account-user" type="button">
            <span className="ws-avatar">{(userEmail || "A")[0].toUpperCase()}</span>
            <span className="ws-account-copy">
              <strong>{userEmail || (kh ? "គណនីរបស់អ្នក" : "Your account")}</strong>
              <small>{kh ? "ផ្ទាល់ខ្លួន" : "Personal workspace"}</small>
            </span>
            <span aria-hidden="true">⌄</span>
          </button>
          <button className="ws-icon-btn" type="button" onClick={() => router.push("/")} aria-label={t("settings")}>⚙</button>
        </div>

        <nav className="ws-actions" aria-label={kh ? "សកម្មភាព" : "Actions"}>
          {ACTION_ITEMS.map((item) => (
            <button key={item.label} type="button" onClick={() => item.label === "Projects" ? setImportOpen(true) : item.label === "New chat" ? setWorkspace(null) : undefined}>
              <span>{item.icon}</span><span>{kh ? item.khLabel : item.label}</span>
            </button>
          ))}
        </nav>

        <div className="ws-sidebar-section">
          <div className="ws-sidebar-label">{kh ? "Session ថ្មីៗ" : "Recent sessions"}</div>
          {workspaces.map((ws) => (
            <button key={ws.id} className={`ws-session ${workspace?.id === ws.id ? "active" : ""}`} onClick={() => selectWorkspace(ws)}>
              <span className={`ws-session-dot ${ws.status === "ready" ? "on" : ""}`} />
              <span className="ws-session-copy">
                <strong>{ws.repo_full_name.split("/")[1] || ws.repo_full_name}</strong>
                <small>{ws.repo_full_name}</small>
              </span>
            </button>
          ))}
          {workspaces.length === 0 && !loading && <div className="ws-sidebar-empty">{kh ? "មិនទាន់មានគម្រោង។" : "No projects yet."}</div>}
        </div>

        <div className="ws-sidebar-foot">
          <button type="button" onClick={toggle} className="ws-lang">{kh ? "ខ្មែរ" : "EN"}</button>
          <button type="button" onClick={() => supabase.auth.signOut()} className="ws-signout">{kh ? "ចាកចេញ" : "Sign out"}</button>
        </div>
      </aside>

      <section className="ws-main">
        <header className="ws-topbar">
          <button className="ws-repo-switcher" type="button" onClick={() => setImportOpen(true)}>
            <span className="ws-repo-icon">◈</span>
            <span className="ws-repo-name">{workspace ? workspace.repo_full_name : (kh ? "ជ្រើសរើសគម្រោង" : "Select a project")}</span>
            {workspace && <span className="ws-branch">{workspace.repo_default_branch}</span>}
            <span aria-hidden="true">⌄</span>
          </button>
          <div className="ws-top-actions">
            {workspace && <StatusBadge status={workspace.status === "ready" ? "ready" : "idle"} label={workspace.status === "ready" ? t("ready_") : t("idle_")} />}
            <span className={`ws-telegram-status ${telegram?.state === "connected" ? "active" : ""}`}>
              <i /> {telegram?.state === "connected" ? (kh ? "Telegram សកម្ម" : "Telegram active") : (kh ? "Telegram មិនទាន់ភ្ជាប់" : "Telegram not connected")}
            </span>
            {workspace && <button className="ws-preview-btn" type="button" onClick={() => setPreviewOpen((v) => !v)}>{previewOpen ? (kh ? "បិទ Preview" : "Close preview") : (kh ? "មើលជាមុន" : "Live preview")}</button>}
            {workspace && <Button variant="secondary" className="btn-sm" onClick={() => void deployPreview()} disabled={deploying}>{deploying ? (kh ? "កំពុងបង្ហោះ..." : "Deploying…") : kh ? "បង្ហោះ Vercel" : "Deploy to Vercel"}</Button>}
            {deployMessage && <span className="ws-deploy-message">{deployMessage}</span>}
            <Button variant="secondary" className="btn-sm" onClick={() => setImportOpen(true)}>{kh ? "នាំចូល" : "Import"}</Button>
          </div>
        </header>

        {!workspace ? (
          <div className="ws-empty-wrap">
            <EmptyState
              icon="◇"
              title={loading ? t("loading") : kh ? "នាំចូលគម្រោងដើម្បីចាប់ផ្តើម" : "Import a project to get started"}
              description={kh ? "ជ្រើសរើសឃ្លាំងសម្ងាត់ GitHub របស់អ្នក ហើយ Claude នឹងធ្វើការនៅក្នុង workspace ដែលមានសុវត្ថិភាព។" : "Choose a GitHub repository and Claude will work inside its secure workspace."}
              action={<Button onClick={() => setImportOpen(true)}>{kh ? "នាំចូលពី GitHub" : "Import from GitHub"}</Button>}
            />
          </div>
        ) : (
          <div className="ws-workbench">
            <div className="ws-files">
              <div className="ws-files-head">
                <strong>{activeName}</strong>
                <small>{workspace.repo_default_branch}</small>
              </div>
              <FileTree key={`${workspace.id}:${fileRefresh}`} workspaceId={workspace.id} onSelectFile={openFile} />
            </div>

            <div className="ws-center">
              <div className="ws-chat-frame">
                <ClaudeChat
                  workspaceId={workspace.id}
                  currentFile={currentTab?.path}
                  fileContent={currentTab?.content}
                  onApplied={() => setFileRefresh((v) => v + 1)}
                />
              </div>

              <div className="ws-composer">
                <button className="ws-attach" type="button" onClick={() => setAttachOpen((v) => !v)} aria-expanded={attachOpen} aria-label={kh ? "ភ្ជាប់" : "Attach"}>＋</button>
                <div className="ws-composer-hint">
                  <strong>{kh ? "សួរអ្វីមួយអំពីគម្រោងនេះ" : "Ask anything about this project"}</strong>
                  <span>{currentTab ? `${kh ? "ឯកសារ" : "Context"}: ${currentTab.path}` : kh ? "ប្រើ model picker ខាងលើដើម្បីជ្រើសរើស model និង mode" : "Use the model picker above to choose model and mode"}</span>
                </div>
                {attachOpen && (
                  <div className="ws-attach-menu" role="menu">
                    <button type="button" onClick={() => { setAttachOpen(false); setImportOpen(true); }}>{kh ? "នាំចូលពី GitHub" : "Import from GitHub"}</button>
                    <button type="button" disabled>{kh ? "Upload Files (ឆាប់ៗ)" : "Upload Files (coming soon)"}</button>
                    <button type="button" disabled>{kh ? "Drive (ឆាប់ៗ)" : "Drive (coming soon)"}</button>
                  </div>
                )}
              </div>
            </div>

            <div className="ws-codepane">
              {currentTab ? (
                <>
                  <div className="ws-file-tabs">
                    {openTabs.map((tab, i) => (
                      <div key={tab.path} className={`ws-file-tab ${i === activeTab ? "active" : ""}`} onClick={() => setActiveTab(i)}>
                        <span>{tab.path.split("/").pop()}</span>
                        <button onClick={(e) => { e.stopPropagation(); closeFileTab(i); }} aria-label="Close">×</button>
                      </div>
                    ))}
                  </div>
                  <CodeViewer path={currentTab.path} content={currentTab.content} />
                </>
              ) : (
                <div className="ws-code-empty">
                  <EmptyState icon="📄" title={kh ? "មិនមានឯកសារបើក" : "No file open"} description={kh ? "ជ្រើសរើសឯកសារដើម្បីមើល code និង diff។" : "Select a file to view code and diffs."} />
                </div>
              )}
              <div className="ws-diff">
                <DiffViewer workspaceId={workspace.id} compact />
              </div>
            </div>
            {previewOpen && previewUrl && (
              <aside className="ws-preview-drawer">
                <div className="ws-preview-head"><strong>{kh ? "Live Preview" : "Live preview"}</strong><button type="button" onClick={() => setPreviewOpen(false)} aria-label="Close">×</button></div>
                <iframe title={kh ? "មើលជាមុន" : "Live preview"} src={previewUrl} />
              </aside>
            )}
          </div>
        )}
      </section>

      <GitHubImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={selectWorkspace} />
    </main>
  );
}
