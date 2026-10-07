import type {
  GitHubRepo,
  Workspace,
  Deployment,
  FileNode,
  Activity,
  ChatMessage,
  CommandResult,
  TelegramStatus,
} from "./types";
import { supabase } from "./supabase-client";

async function getAuthToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json();
  if (!res.ok) {
    if (data.authRequired) {
      throw new Error("AUTH_REQUIRED");
    }
    if (data.syncRequired) {
      throw new Error(data.error || "Workspace must be synced again");
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  githubStatus: () =>
    fetchJson<{
      configured: boolean;
      username?: string;
      avatar_url?: string;
      setupRequired?: boolean;
      envVars?: string[];
      message?: string;
    }>("/api/github/status"),

  githubRepos: () => fetchJson<{ repos: GitHubRepo[] }>("/api/github/repos"),

  syncRepo: (repoFullName: string, force = false) =>
    fetchJson<{ workspace: Workspace; canPush?: boolean }>("/api/workspace/sync", {
      method: "POST",
      body: JSON.stringify({ repoFullName, force }),
    }),

  listWorkspaces: () =>
    fetchJson<{ workspaces: Workspace[] }>("/api/workspace/list"),

  getFiles: (workspaceId: string) =>
    fetchJson<{ tree: FileNode[] }>(
      `/api/workspace/files?workspaceId=${workspaceId}`
    ),

  getFileContent: (workspaceId: string, path: string) =>
    fetchJson<{ path: string; content: string }>(
      `/api/workspace/files?workspaceId=${workspaceId}&path=${encodeURIComponent(path)}`
    ),

  getDiff: (workspaceId: string) =>
    fetchJson<{ diff: string; changedFiles: string[] }>(
      `/api/workspace/diff?workspaceId=${workspaceId}`
    ),

  commit: (workspaceId: string, message: string) =>
    fetchJson<{ success: boolean; backupTag: string; branch?: string; commit?: string }>(
      "/api/workspace/commit",
      { method: "POST", body: JSON.stringify({ workspaceId, message }) }
    ),

  rollback: (workspaceId: string, tag: string) =>
    fetchJson<{ success: boolean }>("/api/workspace/rollback", {
      method: "POST",
      body: JSON.stringify({ workspaceId, tag }),
    }),

  runCommand: (workspaceId: string, command: string) =>
    fetchJson<CommandResult>("/api/workspace/run", {
      method: "POST",
      body: JSON.stringify({ workspaceId, command }),
    }),

  health: () =>
    fetchJson<{ github: boolean; claude: boolean; supabase: boolean; vercel: boolean }>(
      "/api/health"
    ),

  deployVercel: (
    workspaceId: string,
    target: "preview" | "production" = "preview"
  ) =>
    fetchJson<{ deployment: { id: string; status: Deployment["status"]; url: string | null; target: string } }>(
      "/api/deploy/vercel",
      {
        method: "POST",
        body: JSON.stringify({
          workspaceId,
          target,
          confirmProduction: target === "production",
        }),
      }
    ),

  getVercelDeployments: (workspaceId: string) =>
    fetchJson<{ deployments: Deployment[] }>(
      `/api/deploy/vercel?workspaceId=${workspaceId}`
    ),

  applyChanges: (
    workspaceId: string,
    files: { path: string; content: string }[]
  ) =>
    fetchJson<{ applied: boolean; filesChanged: string[] }>(
      "/api/claude/apply",
      { method: "POST", body: JSON.stringify({ workspaceId, files }) }
    ),

  claudeChat: (
    workspaceId: string,
    message: string,
    options?: { currentFile?: string; fileContent?: string }
  ) =>
    fetchJson<{
      response: string;
      filesChanged: string[];
      proposedFiles: { path: string; content: string }[];
      diff: string | null;
      applied: boolean;
    }>("/api/claude/chat", {
      method: "POST",
      body: JSON.stringify({ workspaceId, message, ...options }),
    }),

  getMessages: (workspaceId: string) =>
    fetchJson<{ messages: ChatMessage[] }>(
      `/api/claude/messages?workspaceId=${workspaceId}`
    ),

  // Optional Telegram connector. The bot token is server-side only and never passes through here.
  telegramStatus: () => fetchJson<TelegramStatus>("/api/telegram/status"),

  telegramConnect: (chatId?: string) =>
    fetchJson<TelegramStatus>("/api/telegram/connect", {
      method: "POST",
      body: JSON.stringify({ chatId: chatId || undefined }),
    }),

  telegramTest: () =>
    fetchJson<TelegramStatus & { sentToChat?: boolean }>("/api/telegram/test", {
      method: "POST",
    }),

  telegramDisconnect: () =>
    fetchJson<TelegramStatus>("/api/telegram/disconnect", { method: "POST" }),

  getActivities: (workspaceId?: string) =>
    fetchJson<{ activities: Activity[] }>(
      `/api/activities${workspaceId ? `?workspaceId=${workspaceId}` : ""}`
    ),
};
