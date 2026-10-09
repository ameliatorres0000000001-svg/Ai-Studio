"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase-client";
import type { Workspace } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { RepoSelector } from "@/components/RepoSelector";
import { FileTree } from "@/components/FileTree";
import { CodeViewer } from "@/components/CodeViewer";
import { ClaudeChat } from "@/components/ClaudeChat";
import { ActivityHistory } from "@/components/ActivityHistory";
import { DiffViewer } from "@/components/DiffViewer";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { TelegramConnector, TELEGRAM_CHANGED_EVENT } from "@/components/TelegramConnector";
import { DashboardView } from "@/components/Dashboard";
import { Subscription } from "@/components/Subscription";
import type { TelegramStatus } from "@/lib/types";
import { BottomPanel } from "@/components/BottomPanel";
import { CommandPalette } from "@/components/CommandPalette";
import { Button, StatusBadge, EmptyState, BrandIcon } from "@/components/ui";

type Tab = "Dashboard" | "Projects" | "Workspace" | "Subscription" | "Settings";

const NAV_ITEMS: { id: Tab; icon: ReactNode; labelKey: "dashboard" | "projects" | "workspace" | "subscription" | "settings"; needsWorkspace?: boolean }[] = [
  { id: "Dashboard", icon: "▣", labelKey: "dashboard" },
  { id: "Projects", icon: "◉", labelKey: "projects" },
  { id: "Workspace", icon: "▸", labelKey: "workspace", needsWorkspace: true },
  { id: "Subscription", icon: "◆", labelKey: "subscription" },
  { id: "Settings", icon: "⚙", labelKey: "settings" },
];

const WORKFLOW_STEPS = ["github", "select", "claudeCode", "edit", "diff", "test", "approve", "push"] as const;

export default function Home() {
  const { t, lang, toggle } = useLang();
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentFile, setCurrentFile] = useState<{ path: string; content: string } | null>(null);
  const [openTabs, setOpenTabs] = useState<{ path: string; content: string }[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [githubStatus, setGithubStatus] = useState<{ configured: boolean; username?: string } | null>(null);
  const [bottomOpen, setBottomOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    api.githubStatus().then(setGithubStatus).catch(() => {});
    api.listWorkspaces().then(({ workspaces }) => setWorkspaces(workspaces)).catch(() => {});
  }, []);

  // Ctrl+K command palette
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const selectWorkspace = useCallback((ws: Workspace) => {
    setWorkspace(ws);
    setCurrentFile(null);
    setOpenTabs([]);
    setActiveTab(0);
    setTab("Workspace");
    api.listWorkspaces().then(({ workspaces }) => setWorkspaces(workspaces)).catch(() => {});
  }, []);

  function openFile(path: string, content: string) {
    const existing = openTabs.find((t) => t.path === path);
    if (existing) {
      setActiveTab(openTabs.findIndex((t) => t.path === path));
      return;
    }
    const newTabs = [...openTabs, { path, content }];
    setOpenTabs(newTabs);
    setActiveTab(newTabs.length - 1);
  }

  function closeFileTab(idx: number) {
    const next = openTabs.filter((_, i) => i !== idx);
    setOpenTabs(next);
    if (activeTab >= next.length) setActiveTab(Math.max(0, next.length - 1));
  }

  const activeStepIndex = workspace
    ? tab === "Workspace" ? 2 : 3
    : githubStatus?.configured ? 1 : 0;

  const paletteCommands = [
    { id: "dashboard", label: t("dashboard"), icon: "▣", action: () => setTab("Dashboard") },
    { id: "projects", label: t("projects"), icon: "◉", action: () => setTab("Projects") },
    { id: "workspace", label: t("workspace"), icon: "▸", action: () => workspace && setTab("Workspace") },
    { id: "subscription", label: t("subscription"), icon: "◆", action: () => setTab("Subscription") },
    { id: "settings", label: t("settings"), icon: "⚙", action: () => setTab("Settings") },
    { id: "lang-kh", label: "ខ្មែរ (KH)", icon: "ខ", action: () => {} },
    { id: "lang-en", label: "English (EN)", icon: "EN", action: () => {} },
  ];

  return (
    <main className={lang === "kh" ? "lang-kh" : "lang-en"}>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={paletteCommands}
      />

      <aside>
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark"><BrandIcon name="claude" size={32} /></div>
          <div>
            <div className="sidebar-brand-name">{t("productName")}</div>
            <div className="sidebar-brand-sub">{t("subtitle")}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
              disabled={item.needsWorkspace && !workspace}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{t(item.labelKey)}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-divider" />

        <div className="sidebar-section-label">{t("connected")}</div>
        <div className="sidebar-connections">
          <ConnectionStatus />
        </div>

        {workspace && (
          <>
            <div className="sidebar-divider" />
            <div className="sidebar-active-project">
              <div className="ap-label">{t("activeProject")}</div>
              <div className="ap-name">{workspace.repo_full_name}</div>
              <div className="ap-meta">
                <span>{t("branch")}: {workspace.repo_default_branch}</span>
              </div>
              <div className="ap-status">
                <StatusBadge
                  status={workspace.status === "ready" ? "ready" : workspace.status === "syncing" ? "syncing" : "idle"}
                  label={workspace.status === "ready" ? t("ready_") : workspace.status === "syncing" ? t("syncing_") : t("idle_")}
                />
              </div>
            </div>
          </>
        )}

        <div className="sidebar-footer">
          <button className="lang-switch" onClick={toggle}>
            <span className={lang === "kh" ? "lang-active" : ""}>ខ្មែរ</span>
            <span className="lang-sep">|</span>
            <span className={lang === "en" ? "lang-active" : ""}>EN</span>
          </button>
          <button className="lang-switch" onClick={() => supabase.auth.signOut()} style={{ marginTop: 8 }}>
            <span>{lang === "kh" ? "ចាកចេញ" : "Sign out"}</span>
          </button>
        </div>
      </aside>

      <section>
        <header>
          <div className="header-title">
            {workspace ? (
              <>
                <strong>{workspace.repo_full_name}</strong>
                <span>·</span>
                <span>{t(tab.toLowerCase() as any) || tab}</span>
              </>
            ) : (
              <span>{t("subtitle")} — {lang === "kh" ? "ភ្ជាប់ GitHub និងជ្រើសរើសឃ្លាំងសម្ងាត់" : "Connect GitHub and select a repository"}</span>
            )}
          </div>
          <div className="header-actions">
            <button className="header-cmd-btn" onClick={() => setPaletteOpen(true)}>
              <span>⌕</span>
              <small>Ctrl K</small>
            </button>
            <div className="header-brand">{t("productName")}</div>
          </div>
        </header>

        {tab !== "Workspace" && (
          <div className="wrap">
            {(tab === "Dashboard" || tab === "Projects") && <WorkflowBar activeStep={activeStepIndex} steps={WORKFLOW_STEPS} t={t} />}

            {tab === "Dashboard" && (
              <DashboardView
                workspace={workspace}
                workspaces={workspaces}
                onSelectWorkspace={selectWorkspace}
                setTab={setTab}
              />
            )}

            {tab === "Projects" && (
              <ProjectsView workspaces={workspaces} onSelectWorkspace={selectWorkspace} />
            )}

            {tab === "Subscription" && (
              <div className="panel">
                <div className="panel-header">
                  <h3>{t("subscription")}</h3>
                </div>
                <Subscription />
              </div>
            )}

            {tab === "Settings" && <SettingsView githubStatus={githubStatus} />}
          </div>
        )}

        {tab === "Workspace" && workspace && (
          <IDEWorkspace
            workspace={workspace}
            openTabs={openTabs}
            activeTab={activeTab}
            onOpenFile={openFile}
            onCloseTab={closeFileTab}
            setActiveTab={setActiveTab}
            bottomOpen={bottomOpen}
            setBottomOpen={setBottomOpen}
          />
        )}

        {tab === "Workspace" && !workspace && (
          <div className="wrap">
            <div className="panel">
              <EmptyState
                icon="▸"
                title={t("noProjectSelected")}
                description={t("noProjectDesc")}
                action={<Button onClick={() => setTab("Projects")}>{t("browseProjects")}</Button>}
              />
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function WorkflowBar({ activeStep, steps, t }: { activeStep: number; steps: readonly string[]; t: (k: any) => string }) {
  return (
    <div className="workflow">
      {steps.map((step, i) => (
        <div key={step} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <div className={`workflow-step ${i === activeStep ? "active" : ""} ${i < activeStep ? "done" : ""}`}>
            <span className="workflow-step-num">{i < activeStep ? "✓" : i + 1}</span>
            {t(step)}
          </div>
          {i < steps.length - 1 && <span className="workflow-arrow">→</span>}
        </div>
      ))}
    </div>
  );
}

function ProjectsView({
  workspaces,
  onSelectWorkspace,
}: {
  workspaces: Workspace[];
  onSelectWorkspace: (ws: Workspace) => void;
}) {
  const { t } = useLang();
  return (
    <>
      <RepoSelector onSelect={onSelectWorkspace} />
      {workspaces.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-header">
            <h3>{t("syncedWorkspaces")}</h3>
          </div>
          <div className="projectgrid">
            {workspaces.map((ws) => (
              <button key={ws.id} className="project" onClick={() => onSelectWorkspace(ws)}>
                <span className="project-icon">◈</span>
                <b>{ws.repo_full_name}</b>
                <small>{t("branch")}: {ws.repo_default_branch}</small>
                <em>{ws.status === "ready" ? t("ready_") : t("idle_")}</em>
                <small>{t("lastSynced")}: {ws.last_synced_at ? new Date(ws.last_synced_at).toLocaleDateString() : "—"}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function IDEWorkspace({
  workspace,
  openTabs,
  activeTab,
  onOpenFile,
  onCloseTab,
  setActiveTab,
  bottomOpen,
  setBottomOpen,
}: {
  workspace: Workspace;
  openTabs: { path: string; content: string }[];
  activeTab: number;
  onOpenFile: (path: string, content: string) => void;
  onCloseTab: (idx: number) => void;
  setActiveTab: (i: number) => void;
  bottomOpen: boolean;
  setBottomOpen: (v: boolean) => void;
}) {
  const { t, lang } = useLang();
  const [leftWidth, setLeftWidth] = useState(260);
  const [resizing, setResizing] = useState(false);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    setResizing(true);

    function onMove(e: MouseEvent) {
      const newWidth = Math.max(180, Math.min(400, e.clientX - 240));
      setLeftWidth(newWidth);
    }
    function onUp() {
      setResizing(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const currentTab = openTabs[activeTab];

  return (
    <div className={`ide-workspace ${bottomOpen ? "" : "bottom-closed"}`}>
      <div className="ide-left" style={{ width: leftWidth, flexShrink: 0 }}>
        <div className="ide-left-header">
          <span>{workspace.repo_full_name.split("/")[1]}</span>
          <small>{t("branch")}: {workspace.repo_default_branch}</small>
        </div>
        <div className="ide-left-body">
          <FileTree workspaceId={workspace.id} onSelectFile={onOpenFile} />
        </div>
      </div>

      <div className="ide-resizer" onMouseDown={startResize} style={{ cursor: resizing ? "grabbing" : "col-resize" }} />

      <div className="ide-center">
        <ClaudeChat
          workspaceId={workspace.id}
          currentFile={currentTab?.path}
          fileContent={currentTab?.content}
          onApplied={() => {}}
        />
      </div>

      <div className="ide-right">
        <div className="ide-right-tabs">
          {openTabs.length === 0 ? (
            <div className="ide-right-empty">
              <div className="empty-state">
                <div className="empty-icon">📄</div>
                <h4>{lang === "kh" ? "មិនមានឯកសារបើក" : "No file open"}</h4>
                <p>{lang === "kh" ? "ជ្រើសរើសឯកសារពីខ្សែរឯកសារនៅឆ្វេងដៃ។" : "Select a file from the tree on the left."}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="file-tab-bar">
                {openTabs.map((ft, i) => (
                  <div
                    key={i}
                    className={`file-tab ${activeTab === i ? "active" : ""}`}
                    onClick={() => setActiveTab(i)}
                  >
                    <span>{ft.path.split("/").pop()}</span>
                    <button className="file-tab-close" onClick={(e) => { e.stopPropagation(); onCloseTab(i); }}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="ide-right-content">
                {currentTab && <CodeViewer path={currentTab.path} content={currentTab.content} />}
              </div>
            </>
          )}
        </div>

        <div className="ide-right-diff">
          <DiffViewer workspaceId={workspace.id} compact />
        </div>
      </div>

      <div className="ide-bottom">
        {bottomOpen ? (
          <BottomPanel workspaceId={workspace.id} onClose={() => setBottomOpen(false)} />
        ) : (
          <button className="bottom-expand" onClick={() => setBottomOpen(true)}>
            ▲ {t("terminal")} · {t("logs")} · {t("tests")} · {t("gitDiff")} · {t("deployments")} · {t("activityHistory")}
          </button>
        )}
      </div>
    </div>
  );
}

function SettingsView({ githubStatus }: { githubStatus: any }) {
  const { t } = useLang();
  return (
    <div className="panel">
      <div className="panel-header">
        <h3>{t("settingsConfig")}</h3>
      </div>
      <p>{t("envVars")} — {t("integrationStatus")}</p>

      <div className="settings-section">
        <h4>{t("githubSetting")}</h4>
        <p>Status: <StatusBadge status={githubStatus?.configured ? "connected" : "disconnected"} /></p>
        {githubStatus?.configured && (
          <p style={{ marginTop: 4 }}>{t("connectedAs")} <strong>{githubStatus.username}</strong></p>
        )}
        {!githubStatus?.configured && (
          <div className="setup-box">
            <p>{lang_setup_github(t)}</p>
            <p>Set <code>GITHUB_ACCESS_TOKEN</code> in your <code>.env</code> file.</p>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h4><BrandIcon name="claude" /> {t("claudeSetting")}</h4>
        <p>Status: <StatusBadge status="disconnected" /></p>
        <div className="setup-box">
          <p>Set the gateway key (<code>AI_GATEWAY_API_KEY</code>) and base URLs (<code>AI_GATEWAY_BASE_URL</code>, <code>AI_GATEWAY_OPENAI_BASE_URL</code>) in your <code>.env</code> file. Optional direct keys: <code>ANTHROPIC_API_KEY</code>, <code>GOOGLE_AI_API_KEY</code>, <code>OPENROUTER_API_KEY</code>, <code>BEDROCK_API_KEY</code>.</p>
        </div>
      </div>

      <div className="settings-section">
        <h4><BrandIcon name="supabase" /> {t("supabaseSetting")}</h4>
        <p>Status: <StatusBadge status="connected" /></p>
      </div>

      <div className="settings-section">
        <h4><BrandIcon name="plug" /> Connectors / Integrations</h4>
        <TelegramConnector />
      </div>

      <div className="settings-section">
        <h4>{t("vercelSetting")} & {t("railwaySetting")}</h4>
        <p>Status: <StatusBadge status="disconnected" /></p>
        <div className="setup-box">
          <p>Set <code>VERCEL_TOKEN</code> and <code>RAILWAY_TOKEN</code> in your <code>.env</code> file to enable deployments.</p>
        </div>
      </div>

      <div className="settings-section">
        <h4>{t("requiredEnvVars")}</h4>
        <pre className="env-list">{`# GitHub
GITHUB_ACCESS_TOKEN=
GITHUB_ALLOWED_REPOS=

# Model gateway (Anthropic + OpenAI formats)
AI_GATEWAY_API_KEY=
AI_GATEWAY_BASE_URL=
AI_GATEWAY_OPENAI_BASE_URL=

# Direct providers (optional)
ANTHROPIC_API_KEY=
GOOGLE_AI_BASE_URL=
GOOGLE_AI_API_KEY=
OPENROUTER_BASE_URL=
OPENROUTER_API_KEY=
BEDROCK_BASE_URL=
BEDROCK_API_KEY=
AI_MAX_TOKENS=

# Plans, quotas, admin
ADMIN_EMAILS=
ALLOWED_USER_EMAILS=

# Payments (manual KHQR review)
FEATURE_PAYMENTS=
PAYMENTS_KHQR_IMAGE_URL=

# Telegram connector (optional, server-side only)
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_USER_IDS=

# Deployments
VERCEL_TOKEN=
VERCEL_PROJECT_NAME=
VERCEL_TEAM_ID=
RAILWAY_TOKEN=

# Git identity for the Commit button
GIT_COMMIT_NAME=
GIT_COMMIT_EMAIL=

# Server
WORKSPACE_ROOT=

# Supabase (auto-configured)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=`}</pre>
      </div>
    </div>
  );
}

function lang_setup_github(t: (k: any) => string) {
  return "Create a Personal Access Token at github.com/settings/tokens with `repo` scope.";
}
