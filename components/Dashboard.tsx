"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Workspace, Activity, GitHubRepo } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { Button, StatusBadge, EmptyState, BrandIcon } from "@/components/ui";

type Tab = "Dashboard" | "Projects" | "Workspace" | "Subscription" | "Settings";

interface Health {
  github: boolean;
  claude: boolean;
  supabase: boolean;
  vercel: boolean;
}

interface Usage {
  plan: string;
  dailyLimit: number;
  today: { requests: number; inputTokens: number; outputTokens: number };
}

/** Real dashboard: plan + usage bar, live connection dots, recent repos/activity. */
export function DashboardView({
  workspace,
  workspaces,
  onSelectWorkspace,
  setTab,
}: {
  workspace: Workspace | null;
  workspaces: Workspace[];
  onSelectWorkspace: (ws: Workspace) => void;
  setTab: (t: Tab) => void;
}) {
  const { t, lang } = useLang();
  const [health, setHealth] = useState<Health | null>(null);
  const [github, setGithub] = useState<{ configured: boolean; username?: string } | null>(null);
  const [telegram, setTelegram] = useState<{ state: string; bot?: { username: string | null } } | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
    api.githubStatus().then(setGithub).catch(() => setGithub(null));
    api.telegramStatus().then((s: any) => setTelegram(s)).catch(() => setTelegram(null));
    api.getUsage().then(setUsage).catch(() => setUsage(null));
    api.getActivities().then(({ activities }) => setActivities(activities.slice(0, 5))).catch(() => setActivities(null));
    api.githubRepos().then(({ repos }) => setRepos(repos.slice(0, 5))).catch(() => setRepos([]));
  }, []);

  const dots: { id: string; label: string; icon: "github" | "claude" | "supabase" | "telegram" | "plug"; on: boolean; detail?: string }[] = [
    { id: "github", label: "GitHub", icon: "github", on: !!health?.github, detail: github?.username },
    { id: "models", label: "Models", icon: "claude", on: !!health?.claude },
    { id: "supabase", label: "Supabase", icon: "supabase", on: !!health?.supabase },
    { id: "telegram", label: "Telegram", icon: "telegram", on: telegram?.state === "connected", detail: (telegram as any)?.bot?.username },
    { id: "vercel", label: "Vercel", icon: "plug", on: !!health?.vercel },
  ];

  const pct = usage && usage.dailyLimit > 0
    ? Math.min(100, Math.round((usage.today.requests / usage.dailyLimit) * 100))
    : 0;

  return (
    <>
      <div className="hero">
        <div>
          <div className="hero-label">{t("subtitle")}</div>
          <h1>{lang === "kh" ? "សាងសង់ កែសម្រួល និងបង្ហោះជាមួយ Coding Agent" : "Build, edit & deploy with Coding Agent."}</h1>
          <p>{t("selectRepoDesc")}</p>
        </div>
        <Button onClick={() => setTab("Projects")}>{t("selectRepo")} →</Button>
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <h3>{t("myPlan")}{usage ? ` · ${usage.plan.toUpperCase()}` : ""}</h3>
            <Button variant="ghost" className="btn-sm" onClick={() => setTab("Subscription")}>
              {t("getPlan")}
            </Button>
          </div>
          {usage ? (
            <div>
              <small style={{ color: "var(--text-2)" }}>
                {t("usedToday")}: {usage.today.requests}/{usage.dailyLimit} {t("requestsLabel")}
              </small>
              <div className="usage-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <i style={{ width: `${pct}%` }} />
              </div>
              <p style={{ marginTop: 8 }}>
                {usage.today.inputTokens} in · {usage.today.outputTokens} out
              </p>
            </div>
          ) : (
            <p>{t("loading")}</p>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>{t("integrationStatus")}</h3>
          </div>
          <div className="status-dots">
            {dots.map((d) => (
              <div key={d.id} className="status-dot-row">
                <span className={`dot ${d.on ? "on" : "off"}`} />
                <span className="brand-icon-slot"><BrandIcon name={d.icon} size={16} /></span>
                <span className="dot-row-label">{d.label}{d.detail ? ` · ${d.detail}` : ""}</span>
                <small style={{ color: d.on ? "var(--success)" : "var(--text-3)" }}>
                  {d.on ? t("connected_") : t("notConfigured")}
                </small>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>{t("recentRepos")}</h3>
            <Button variant="ghost" className="btn-sm" onClick={() => setTab("Projects")}>
              {t("browseProjects")}
            </Button>
          </div>
          {!repos ? (
            <p>{t("loading")}</p>
          ) : repos.length === 0 ? (
            <EmptyState icon="◉" title={t("noProject")} description={t("selectRepoDesc")} />
          ) : (
            <div className="dash-workspace-list">
              {repos.map((r) => {
                const ws = workspaces.find((w) => w.repo_full_name === r.full_name);
                return (
                  <div key={r.id} className="row" style={{ cursor: ws ? "pointer" : "default" }} onClick={() => ws && onSelectWorkspace(ws)}>
                    <span className="row-icon">◈</span>
                    <span className="row-text">
                      <b>{r.full_name}</b>
                      <small>{t("branch")}: {r.default_branch}</small>
                    </span>
                    <em>{ws ? t("ready_") : ""}</em>
                    <span className="row-tag">{r.private ? t("private") : t("public")}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>{t("recentActivity")}</h3>
          </div>
          {!activities ? (
            <p>{t("loading")}</p>
          ) : activities.length === 0 ? (
            <EmptyState icon="◷" title={t("noActivity")} description={t("noActivityDesc")} />
          ) : (
            <div className="activity-list">
              {activities.map((a) => (
                <div key={a.id} className="activity-row">
                  <span className="activity-dot">●</span>
                  <div className="activity-content">
                    <b>{a.title}</b>
                    <small>{new Date(a.created_at).toLocaleString()}</small>
                  </div>
                  <em className="activity-type">{a.type}</em>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel" style={{ gridColumn: "span 2" }}>
          <div className="panel-header">
            <h3>{t("quickStart")}</h3>
          </div>
          <div className="chat-actions">
            {workspace && (
              <Button variant="secondary" onClick={() => setTab("Workspace")}>
                {t("openWorkspace")} →
              </Button>
            )}
            <Button variant="secondary" onClick={() => setTab("Projects")}>
              {t("selectProject")}
            </Button>
            <Button variant="secondary" onClick={() => setTab("Subscription")}>
              {t("getPlan")}
            </Button>
          </div>
          {workspace && (
            <div className="dash-project-info" style={{ marginTop: 12 }}>
              <div className="dash-project-name">{workspace.repo_full_name}</div>
              <div className="dash-project-meta">
                <span>{t("branch")}: {workspace.repo_default_branch}</span>
                <StatusBadge
                  status={workspace.status === "ready" ? "ready" : "idle"}
                  label={workspace.status === "ready" ? t("ready_") : t("idle_")}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
