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
import DashboardPreview from "@/components/DashboardPreview";
import type { TelegramStatus } from "@/lib/types";
import { BottomPanel } from "@/components/BottomPanel";
import { CommandPalette } from "@/components/CommandPalette";
import { Button, StatusBadge, EmptyState, BrandIcon } from "@/components/ui";

type Tab = "Dashboard" | "Projects" | "Workspace" | "Preview" | "Settings";

const PreviewIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const NAV_ITEMS: { id: Tab; icon: ReactNode; labelKey: "dashboard" | "projects" | "workspace" | "preview" | "settings"; needsWorkspace?: boolean }[] = [
  { id: "Dashboard", icon: "▣", labelKey: "dashboard" },
  { id: "Projects", icon: "◉", labelKey: "projects" },
  { id: "Workspace", icon: "▸", labelKey: "workspace", needsWorkspace: true },
  { id: "Preview", icon: PreviewIcon, labelKey: "preview" },
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
    { id: "preview", label: t("preview"), icon: "◎", action: () => setTab("Preview") },
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
            {tab !== "Preview" && <WorkflowBar activeStep={activeStepIndex} steps={WORKFLOW_STEPS} t={t} />}

            {tab === "Dashboard" && (
              <DashboardView
                githubStatus={githubStatus}
                workspace={workspace}
                workspaces={workspaces}
                onSelectWorkspace={selectWorkspace}
                setTab={setTab}
              />
            )}

            {tab === "Projects" && (
              <ProjectsView workspaces={workspaces} onSelectWorkspace={selectWorkspace} />
            )}

            {tab === "Preview" && <DashboardPreview embedded />}

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

function DashboardView({
  githubStatus,
  workspace,
  workspaces,
  onSelectWorkspace,
  setTab,
}: {
  githubStatus: any;
  workspace: Workspace | null;
  workspaces: Workspace[];
  onSelectWorkspace: (ws: Workspace) => void;
  setTab: (t: Tab) => void;
}) {
  const { t, lang } = useLang();
  const [health, setHealth] = useState<{ claude: boolean; supabase: boolean; vercel: boolean } | null>(null);
  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  const [telegram, setTelegram] = useState<TelegramStatus | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .telegramStatus()
        .then((st) => alive && setTelegram(st))
        .catch(() => alive && setTelegram(null));
    load();
    window.addEventListener(TELEGRAM_CHANGED_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(TELEGRAM_CHANGED_EVENT, load);
    };
  }, []);

  // Same underlying status sources as before; only the presentation changed.
  const integrations: {
    id: string;
    name: string;
    description: string;
    icon: "github" | "claude" | "supabase" | "telegram";
    connected: boolean;
    detail?: string;
  }[] = [
    {
      id: "github",
      name: "GitHub",
      description: "Connect your GitHub repository",
      icon: "github",
      connected: !!githubStatus?.configured,
      detail: githubStatus?.username ? `${t("connectedAs")} ${githubStatus.username}` : undefined,
    },
    { id: "claude", name: "Claude Code", description: "Connect your Claude Code workspace", icon: "claude", connected: !!health?.claude },
    { id: "supabase", name: "Supabase", description: "Connect your Supabase project", icon: "supabase", connected: !!health?.supabase },
    {
      id: "telegram",
      name: "Telegram",
      description: "Connect your Telegram bot",
      icon: "telegram",
      connected: telegram?.state === "connected",
      detail: telegram?.state === "connected" && telegram.bot?.username ? `@${telegram.bot.username}` : undefined,
    },
  ];

  return (
    <>
      <div className="hero">
        <div>
          <div className="hero-label">{t("subtitle")}</div>
          <h1>{lang === "kh" ? "សាងសង់ កែសម្រួល និងបង្ហោះជាមួយ Claude Code" : "Build, edit & deploy with Claude Code."}</h1>
          <p>{t("selectRepoDesc")}</p>
        </div>
        <Button onClick={() => setTab("Projects")}>{t("selectRepo")} →</Button>
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <h3>{t("currentProject")}</h3>
          </div>
          {workspace ? (
            <div className="dash-project-info">
              <div className="dash-project-name">{workspace.repo_full_name}</div>
              <div className="dash-project-meta">
                <span>{t("branch")}: {workspace.repo_default_branch}</span>
                <StatusBadge
                  status={workspace.status === "ready" ? "ready" : "idle"}
                  label={workspace.status === "ready" ? t("ready_") : t("idle_")}
                />
              </div>
              <Button variant="secondary" className="btn-sm" onClick={() => setTab("Workspace")}>
                {t("workspace")} →
              </Button>
            </div>
          ) : (
            <div className="dash-no-project">
              <small>{t("noProject")}</small>
              <Button variant="secondary" className="btn-sm" onClick={() => setTab("Projects")}>
                {t("selectProject")}
              </Button>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>{t("integrationStatus")}</h3>
          </div>
          <div className="integration-list">
            {integrations.map((item) => (
              <div key={item.id} className={`integration-row ${item.connected ? "is-connected" : ""}`}>
                <span className="integration-icon"><BrandIcon name={item.icon} size={20} /></span>
                <span className="integration-copy">
                  <strong>{item.name}</strong>
                  <small>{item.connected && item.detail ? item.detail : item.description}</small>
                </span>
                {item.connected ? (
                  <span className="integration-connected"><i /> {t("connected_")}</span>
                ) : (
                  <button type="button" className="integration-connect" onClick={() => setTab("Settings")}>
                    Connect <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="panel" style={{ gridColumn: "span 2" }}>
          <div className="panel-header">
            <h3>{t("recentActivity")}</h3>
            <Button variant="ghost" className="btn-sm" onClick={() => setTab("Projects")}>
              {t("browseProjects")}
            </Button>
          </div>
          {workspaces.length === 0 ? (
            <EmptyState
              icon="◉"
              title={lang === "kh" ? "មិនមានឃ្លាំងសម្ងាត់បានសមកាល" : "No repositories synced yet"}
              description={lang === "kh" ? "ជ្រើសរើសឃ្លាំងសម្ងាត់ពីផ្ទាំងគម្រោងដើម្បី clone និងចាប់ផ្តើមធ្វើការ。" : "Select a repository from the Projects tab to clone it and start working."}
              action={<Button onClick={() => setTab("Projects")}>{t("selectRepo")}</Button>}
            />
          ) : (
            <div className="dash-workspace-list">
              {workspaces.map((ws) => (
                <button key={ws.id} className="row" onClick={() => onSelectWorkspace(ws)}>
                  <span className="row-icon">◈</span>
                  <span className="row-text">
                    <b>{ws.repo_full_name}</b>
                    <small>{t("branch")}: {ws.repo_default_branch}</small>
                  </span>
                  <em>{ws.status === "ready" ? t("ready_") : t("idle_")}</em>
                  <span className="row-tag">{ws.repo_default_branch}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ProjectsView({
  workspaces,
  onSelectWorkspace,
}: {
  workspaces: Workspace[];
  onSelectWorkspace: (ws: Workspace) => void;
}) {
  const { t, lang } = useLang();
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
          <p>Get an API key from console.anthropic.com and set <code>ANTHROPIC_API_KEY</code> in your <code>.env</code> file.</p>
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
        <pre className="env-list">{`# GitHub (Personal Access Token with repo scope)
GITHUB_ACCESS_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Anthropic / Claude Code
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxx

# Vercel (deployment)
VERCEL_TOKEN=

# Railway (server/bot deployment)
RAILWAY_TOKEN=

# Telegram connector (optional, server-side only)
TELEGRAM_BOT_TOKEN=

# Supabase (auto-configured)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...`}</pre>
      </div>
    </div>
  );
}

function lang_setup_github(t: (k: any) => string) {
  return "Create a Personal Access Token at github.com/settings/tokens with `repo` scope.";
}
