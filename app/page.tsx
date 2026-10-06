"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Workspace, GitHubRepo } from "@/lib/types";
import { RepoSelector } from "@/components/RepoSelector";
import { FileTree } from "@/components/FileTree";
import { CodeViewer } from "@/components/CodeViewer";
import { ClaudeChat } from "@/components/ClaudeChat";
import { Terminal } from "@/components/Terminal";
import { ActivityHistory } from "@/components/ActivityHistory";
import { DiffViewer } from "@/components/DiffViewer";
import { ConnectionStatus } from "@/components/ConnectionStatus";

type Tab =
  | "Dashboard"
  | "Projects"
  | "Workspace"
  | "Claude"
  | "Deployments"
  | "Terminal"
  | "Diff"
  | "Activity"
  | "Settings";

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

  const tabs: Tab[] = [
    "Dashboard",
    "Projects",
    "Workspace",
    "Claude",
    "Terminal",
    "Diff",
    "Activity",
    "Settings",
  ];

  return (
    <main>
      <aside>
        <h2>◈ AI Deploy Studio</h2>
        <small>Build · Connect · Deploy</small>
        {tabs.map((x) => (
          <button
            key={x}
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
            disabled={
              (x === "Workspace" ||
                x === "Claude" ||
                x === "Terminal" ||
                x === "Diff" ||
                x === "Activity") &&
              !workspace
            }
          >
            {x}
          </button>
        ))}
        <hr />
        <small>CONNECTED</small>
        <ConnectionStatus />
        {workspace && (
          <>
            <hr />
            <small>ACTIVE PROJECT</small>
            <p>◈ {workspace.repo_full_name}</p>
            <p>Status: {workspace.status}</p>
          </>
        )}
      </aside>

      <section>
        <header>
          {workspace
            ? `Workspace: ${workspace.repo_full_name}`
            : "AI Developer Workspace — connect GitHub and select a repository"}
          <b>AI Deploy Studio</b>
        </header>

        <div className="wrap">
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
            />
          )}

          {tab === "Claude" && workspace && (
            <ClaudeChat
              workspaceId={workspace.id}
              currentFile={currentFile?.path}
              fileContent={currentFile?.content}
              onApplied={() => {
                // refresh could be added
              }}
            />
          )}

          {tab === "Terminal" && workspace && <Terminal workspaceId={workspace.id} />}

          {tab === "Diff" && workspace && (
            <DiffViewer workspaceId={workspace.id} />
          )}

          {tab === "Activity" && (
            <ActivityHistory workspaceId={workspace?.id} />
          )}

          {tab === "Settings" && <SettingsView githubStatus={githubStatus} />}
        </div>
      </section>
    </main>
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
  setTab: (t: any) => void;
}) {
  return (
    <>
      <div className="hero">
        <div>
          <small>AI DEVELOPER WORKSPACE</small>
          <h1>Build, edit & deploy with Claude.</h1>
          <p>
            GitHub is the main project source. Connect your account, select a
            repository, and let Claude Code analyze, edit, and run your project.
          </p>
        </div>
        <button onClick={() => setTab("Projects")}>Select Repository ↗</button>
      </div>

      <div className="cards">
        <button className="card" onClick={() => setTab("Projects")}>
          <i>◉</i>
          <b>GitHub</b>
          <p>{githubStatus?.configured ? `Connected as ${githubStatus.username}` : "Not connected"}</p>
          Open →
        </button>
        <button className="card" onClick={() => workspace && setTab("Claude")}>
          <i>✦</i>
          <b>Claude</b>
          <p>Analyze and edit code</p>
          Open →
        </button>
        <button className="card" onClick={() => workspace && setTab("Terminal")}>
          <i>▶</i>
          <b>Run</b>
          <p>Build, test, lint</p>
          Open →
        </button>
        <button className="card" onClick={() => workspace && setTab("Diff")}>
          <i>≡</i>
          <b>Diff</b>
          <p>Review and commit changes</p>
          Open →
        </button>
      </div>

      <div className="grid">
        <div className="panel">
          <h3>Recent Workspaces</h3>
          {workspaces.length === 0 ? (
            <p>No repositories synced yet. Select a repository to get started.</p>
          ) : (
            workspaces.map((ws) => (
              <button
                key={ws.id}
                className="row"
                onClick={() => onSelectWorkspace(ws)}
              >
                <strong>◈</strong>
                <span>
                  <b>{ws.repo_full_name}</b>
                  <small>Branch: {ws.repo_default_branch}</small>
                </span>
                <em>{ws.status}</em>
                <small>{ws.repo_default_branch}</small>
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
        <div className="panel" style={{ marginTop: "12px" }}>
          <h3>Synced Workspaces</h3>
          <div className="projectgrid">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                className="project"
                onClick={() => onSelectWorkspace(ws)}
              >
                <i>◈</i>
                <b>{ws.repo_full_name}</b>
                <small>Branch: {ws.repo_default_branch}</small>
                <em>{ws.status}</em>
                <small>Last synced: {ws.last_synced_at ? new Date(ws.last_synced_at).toLocaleDateString() : "—"}</small>
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
}: {
  workspace: Workspace;
  onSelectFile: (path: string, content: string) => void;
  currentFile: { path: string; content: string } | null;
}) {
  return (
    <div className="workspace-view">
      <div className="workspace-sidebar">
        <div className="panel">
          <h3>Files</h3>
          <FileTree workspaceId={workspace.id} onSelectFile={onSelectFile} />
        </div>
      </div>
      <div className="workspace-main">
        {currentFile ? (
          <CodeViewer path={currentFile.path} content={currentFile.content} />
        ) : (
          <div className="panel">
            <h3>Project: {workspace.repo_full_name}</h3>
            <p>Select a file from the tree to view its contents.</p>
            <pre>{`Repository: ${workspace.repo_full_name}\nBranch: ${workspace.repo_default_branch}\nStatus: ${workspace.status}\n\nUse Claude to analyze or edit this project.\nUse Terminal to run commands.\nUse Diff to review and commit changes.`}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsView({ githubStatus }: { githubStatus: any }) {
  return (
    <div className="panel">
      <h3>Settings & Configuration</h3>
      <p>Environment variables and integration status.</p>

      <div className="settings-section">
        <h4>GitHub</h4>
        <p>
          Status:{" "}
          {githubStatus?.configured ? (
            <em style={{ color: "#42ddb1" }}>Connected as {githubStatus.username}</em>
          ) : (
            <em style={{ color: "#f5a623" }}>Not configured</em>
          )}
        </p>
        {!githubStatus?.configured && (
          <div className="setup-box">
            <p>
              <b>Setup:</b> Create a Personal Access Token at
              github.com/settings/tokens with <code>repo</code> scope.
            </p>
            <p>
              Set <code>GITHUB_ACCESS_TOKEN</code> in your{" "}
              <code>.env</code> file.
            </p>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h4>Claude (Anthropic API)</h4>
        <p>
          Status:{" "}
          <em style={{ color: "#f5a623" }}>
            Set ANTHROPIC_API_KEY in .env to enable
          </em>
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
          Status: <em style={{ color: "#42ddb1" }}>Connected</em>
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
