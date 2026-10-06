"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Workspace } from "@/lib/types";
import { RepoSelector } from "@/components/RepoSelector";
import { FileTree } from "@/components/FileTree";
import { CodeViewer } from "@/components/CodeViewer";
import { ClaudeChat } from "@/components/ClaudeChat";
import { Terminal } from "@/components/Terminal";
import { ActivityHistory } from "@/components/ActivityHistory";
import { DiffViewer } from "@/components/DiffViewer";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { Button, StatusBadge, EmptyState } from "@/components/ui";

type Tab =
  | "Dashboard"
  | "Projects"
  | "Workspace"
  | "Claude"
  | "Terminal"
  | "Diff"
  | "Activity"
  | "Settings";

const NAV_ITEMS: { id: Tab; icon: string; label: string; needsWorkspace: boolean }[] = [
  { id: "Dashboard", icon: "▣", label: "Dashboard", needsWorkspace: false },
  { id: "Projects", icon: "◉", label: "Projects", needsWorkspace: false },
  { id: "Workspace", icon: "▸", label: "Workspace", needsWorkspace: true },
  { id: "Claude", icon: "✦", label: "Claude", needsWorkspace: true },
  { id: "Terminal", icon: "▶", label: "Terminal", needsWorkspace: true },
  { id: "Diff", icon: "≡", label: "Diff", needsWorkspace: true },
  { id: "Activity", icon: "◷", label: "Activity", needsWorkspace: true },
  { id: "Settings", icon: "⚙", label: "Settings", needsWorkspace: false },
];

const WORKFLOW_STEPS = [
  "GitHub",
  "Select",
  "Claude",
  "Edit",
  "Diff",
  "Test",
  "Approve",
  "Push",
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentFile, setCurrentFile] = useState<{
    path: string;
    content: string;
  } | null>(null);
  const [githubStatus, setGithubStatus] = useState<{
    configured: boolean;
    username?: string;
  } | null>(null);

  useEffect(() => {
    api.githubStatus().then(setGithubStatus).catch(() => {});
    api.listWorkspaces().then(({ workspaces }) => setWorkspaces(workspaces)).catch(() => {});
  }, []);

  function selectWorkspace(ws: Workspace) {
    setWorkspace(ws);
    setCurrentFile(null);
    setTab("Workspace");
    api.listWorkspaces().then(({ workspaces }) => setWorkspaces(workspaces)).catch(() => {});
  }

  const activeStepIndex = workspace
    ? tab === "Workspace"
      ? 2
      : tab === "Claude"
      ? 3
      : tab === "Diff"
      ? 5
      : tab === "Terminal"
      ? 4
      : 7
    : githubStatus?.configured
    ? 1
    : 0;

  return (
    <main>
      <aside>
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">A</div>
          <div>
            <div className="sidebar-brand-name">AI Deploy Studio</div>
            <div className="sidebar-brand-sub">Build · Connect · Deploy</div>
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
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-divider" />

        <div className="sidebar-section-label">Connected</div>
        <div className="sidebar-connections">
          <ConnectionStatus />
        </div>

        {workspace && (
          <>
            <div className="sidebar-divider" />
            <div className="sidebar-active-project">
              <div className="ap-label">Active Project</div>
              <div className="ap-name">{workspace.repo_full_name}</div>
              <div className="ap-status">
                <StatusBadge
                  status={
                    workspace.status === "ready"
                      ? "ready"
                      : workspace.status === "syncing"
                      ? "syncing"
                      : "idle"
                  }
                />
              </div>
            </div>
          </>
        )}
      </aside>

      <section>
        <header>
          <div className="header-title">
            {workspace ? (
              <>
                <strong>{workspace.repo_full_name}</strong>
                <span>·</span>
                <span>{tab}</span>
              </>
            ) : (
              <span>AI Developer Workspace — connect GitHub and select a repository</span>
            )}
          </div>
          <div className="header-brand">AI Deploy Studio</div>
        </header>

        <div className="wrap">
          <WorkflowBar activeStep={activeStepIndex} />

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
            <ProjectsView
              workspaces={workspaces}
              onSelectWorkspace={selectWorkspace}
            />
          )}

          {tab === "Workspace" && workspace && (
            <WorkspaceView
              workspace={workspace}
              onSelectFile={(path, content) => setCurrentFile({ path, content })}
              currentFile={currentFile}
              setTab={setTab}
            />
          )}

          {tab === "Claude" && workspace && (
            <ClaudeChat
              workspaceId={workspace.id}
              currentFile={currentFile?.path}
              fileContent={currentFile?.content}
              onApplied={() => {}}
            />
          )}

          {tab === "Terminal" && workspace && <Terminal workspaceId={workspace.id} />}

          {tab === "Diff" && workspace && <DiffViewer workspaceId={workspace.id} />}

          {tab === "Activity" && <ActivityHistory workspaceId={workspace?.id} />}

          {tab === "Settings" && <SettingsView githubStatus={githubStatus} />}

          {tab === "Workspace" && !workspace && (
            <div className="panel">
              <EmptyState
                icon="▸"
                title="No project selected"
                description="Select a repository from the Projects tab to start browsing files."
                action={<Button onClick={() => setTab("Projects")}>Browse Projects</Button>}
              />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function WorkflowBar({ activeStep }: { activeStep: number }) {
  return (
    <div className="workflow">
      {WORKFLOW_STEPS.map((step, i) => (
        <div key={step} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <div
            className={`workflow-step ${i === activeStep ? "active" : ""} ${i < activeStep ? "done" : ""}`}
          >
            <span className="workflow-step-num">{i < activeStep ? "✓" : i + 1}</span>
            {step}
          </div>
          {i < WORKFLOW_STEPS.length - 1 && <span className="workflow-arrow">→</span>}
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
  const cards = [
    {
      icon: "◉",
      title: "GitHub",
      desc: githubStatus?.configured
        ? `Connected as ${githubStatus.username}`
        : "Not connected — set GITHUB_ACCESS_TOKEN",
      link: "Open →",
      action: () => setTab("Projects"),
      disabled: false,
    },
    {
      icon: "✦",
      title: "Claude",
      desc: "Analyze and edit code with AI",
      link: "Open →",
      action: () => workspace && setTab("Claude"),
      disabled: !workspace,
    },
    {
      icon: "▶",
      title: "Run & Test",
      desc: "Build, test, and lint in the workspace",
      link: "Open →",
      action: () => workspace && setTab("Terminal"),
      disabled: !workspace,
    },
    {
      icon: "≡",
      title: "Diff & Push",
      desc: "Review changes and commit to GitHub",
      link: "Open →",
      action: () => workspace && setTab("Diff"),
      disabled: !workspace,
    },
  ];

  return (
    <>
      <div className="hero">
        <div>
          <div className="hero-label">AI Developer Workspace</div>
          <h1>Build, edit & deploy with Claude.</h1>
          <p>
            GitHub is the main project source. Connect your account, select a
            repository, and let Claude Code analyze, edit, and run your project.
          </p>
        </div>
        <Button onClick={() => setTab("Projects")}>Select Repository →</Button>
      </div>

      <div className="cards">
        {cards.map((c) => (
          <button
            key={c.title}
            className="card"
            onClick={c.action}
            disabled={c.disabled}
            style={c.disabled ? { opacity: 0.45, cursor: "not-allowed" } : {}}
          >
            <div className="card-icon">{c.icon}</div>
            <div className="card-title">{c.title}</div>
            <div className="card-desc">{c.desc}</div>
            <div className="card-link">{c.link}</div>
          </button>
        ))}
      </div>

      <div className="grid">
        <div className="panel">
          <div className="panel-header">
            <h3>Recent Workspaces</h3>
            <Button variant="ghost" className="btn-sm" onClick={() => setTab("Projects")}>
              Browse all
            </Button>
          </div>
          {workspaces.length === 0 ? (
            <EmptyState
              icon="◉"
              title="No repositories synced yet"
              description="Select a repository from the Projects tab to clone it and start working."
              action={<Button onClick={() => setTab("Projects")}>Select Repository</Button>}
            />
          ) : (
            workspaces.map((ws) => (
              <button
                key={ws.id}
                className="row"
                onClick={() => onSelectWorkspace(ws)}
              >
                <span className="row-icon">◈</span>
                <span className="row-text">
                  <b>{ws.repo_full_name}</b>
                  <small>Branch: {ws.repo_default_branch}</small>
                </span>
                <em>{ws.status}</em>
                <span className="row-tag">{ws.repo_default_branch}</span>
              </button>
            ))
          )}
        </div>
        <ActivityHistory workspaceId={workspace?.id} />
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
  return (
    <>
      <RepoSelector onSelect={onSelectWorkspace} />
      {workspaces.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-header">
            <h3>Synced Workspaces</h3>
          </div>
          <div className="projectgrid">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                className="project"
                onClick={() => onSelectWorkspace(ws)}
              >
                <span className="project-icon">◈</span>
                <b>{ws.repo_full_name}</b>
                <small>Branch: {ws.repo_default_branch}</small>
                <em>{ws.status}</em>
                <small>
                  Last synced:{" "}
                  {ws.last_synced_at
                    ? new Date(ws.last_synced_at).toLocaleDateString()
                    : "—"}
                </small>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function WorkspaceView({
  workspace,
  onSelectFile,
  currentFile,
  setTab,
}: {
  workspace: Workspace;
  onSelectFile: (path: string, content: string) => void;
  currentFile: { path: string; content: string } | null;
  setTab: (t: Tab) => void;
}) {
  return (
    <div className="workspace-view">
      <div className="panel">
        <div className="panel-header">
          <h3>Files</h3>
          <Button variant="ghost" className="btn-sm" onClick={() => setTab("Claude")}>
            Ask Claude →
          </Button>
        </div>
        <FileTree workspaceId={workspace.id} onSelectFile={onSelectFile} />
      </div>
      <div className="workspace-main">
        {currentFile ? (
          <CodeViewer path={currentFile.path} content={currentFile.content} />
        ) : (
          <div className="panel workspace-empty">
            <h3>{workspace.repo_full_name}</h3>
            <p>
              Select a file from the tree to view its contents. Use Claude to
              analyze or edit, Terminal to run commands, and Diff to review and
              commit changes.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <Button variant="secondary" onClick={() => setTab("Claude")}>
                Ask Claude
              </Button>
              <Button variant="secondary" onClick={() => setTab("Terminal")}>
                Open Terminal
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsView({ githubStatus }: { githubStatus: any }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Settings & Configuration</h3>
      </div>
      <p>Environment variables and integration status.</p>

      <div className="settings-section">
        <h4>GitHub</h4>
        <p>
          Status:{" "}
          {githubStatus?.configured ? (
            <StatusBadge status="connected" />
          ) : (
            <StatusBadge status="disconnected" />
          )}
        </p>
        {githubStatus?.configured && (
          <p style={{ marginTop: 4 }}>
            Connected as <strong>{githubStatus.username}</strong>
          </p>
        )}
        {!githubStatus?.configured && (
          <div className="setup-box">
            <p>
              Create a Personal Access Token at github.com/settings/tokens with
              <code> repo </code> scope.
            </p>
            <p>
              Set <code>GITHUB_ACCESS_TOKEN</code> in your <code>.env</code> file.
            </p>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h4>Claude (Anthropic API)</h4>
        <p>
          Status: <StatusBadge status="disconnected" />
        </p>
        <div className="setup-box">
          <p>
            Get an API key from console.anthropic.com and set{" "}
            <code>ANTHROPIC_API_KEY</code> in your <code>.env</code> file.
          </p>
        </div>
      </div>

      <div className="settings-section">
        <h4>Supabase</h4>
        <p>
          Status: <StatusBadge status="connected" />
        </p>
      </div>

      <div className="settings-section">
        <h4>Required Environment Variables</h4>
        <pre className="env-list">{`# GitHub (Personal Access Token with repo scope)
GITHUB_ACCESS_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Anthropic / Claude API
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxx

# Supabase (auto-configured)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...`}</pre>
      </div>
    </div>
  );
}
