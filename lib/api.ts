import type {
  GitHubRepo,
  Workspace,
  Deployment,
  FileNode,
  Activity,
  ChatMessage,
  CommandResult,
  TelegramStatus,
  ModelOption,
  ChatPurpose,
  ChatEffort,
  TokenUsage,
  ChatModelInfo,
} from "./types";
import { supabase } from "./supabase-client";

async function getAuthToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { ...(extra || {}) };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function throwForStatus(res: Response): Promise<never> {
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (data.authRequired) {
    throw new Error("AUTH_REQUIRED");
  }
  if (data.syncRequired) {
    throw new Error(data.error || "Workspace must be synced again");
  }
  const err: any = new Error(
    data.messageEn || data.error || `Request failed (${res.status})`
  );
  err.status = res.status;
  err.data = data;
  throw err;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = await authHeaders({
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  });

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    await throwForStatus(res);
  }
  return (await res.json()) as T;
}

async function fetchForm<T>(url: string, form: FormData): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(url, { method: "POST", headers, body: form });
  if (!res.ok) {
    await throwForStatus(res);
  }
  return (await res.json()) as T;
}

export interface PlanSummary {
  id: string;
  label: string;
  priceUsd: number;
  dailyLimit: number;
  tiers: string[];
  savePct: number;
}

export interface PaymentsConfig {
  enabled: boolean;
  khqrImageUrl: string | null;
  plans: PlanSummary[];
  models: { id: string; label: string; tier: string; icon: string }[];
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

  getModels: () => fetchJson<{ models: ModelOption[]; plan: string }>("/api/models"),

  testModel: (modelId: string) =>
    fetchJson<{ ok: boolean; latencyMs: number; error: string | null }>(
      "/api/models/test",
      { method: "POST", body: JSON.stringify({ modelId }) }
    ),

  getUsage: () =>
    fetchJson<{
      plan: string;
      dailyLimit: number;
      today: { requests: number; inputTokens: number; outputTokens: number };
      days: { date: string; requests: number; inputTokens: number; outputTokens: number }[];
    }>("/api/usage"),

  claudeChat: (
    workspaceId: string,
    message: string,
    options?: {
      modelId?: string;
      purpose?: ChatPurpose;
      effort?: ChatEffort;
      currentFile?: string;
      fileContent?: string;
      attachments?: { path: string; content: string }[];
    }
  ) =>
    fetchJson<{
      response: string;
      filesChanged: string[];
      proposedFiles: { path: string; content: string }[];
      diff: string | null;
      applied: boolean;
      usage?: TokenUsage;
      model?: ChatModelInfo;
    }>("/api/claude/chat", {
      method: "POST",
      body: JSON.stringify({ workspaceId, message, ...options }),
    }),

  getMessages: (workspaceId: string) =>
    fetchJson<{ messages: ChatMessage[] }>(
      `/api/claude/messages?workspaceId=${workspaceId}`
    ),

  paymentsConfig: () => fetchJson<PaymentsConfig>("/api/payments/config"),

  submitPayment: (form: FormData) =>
    fetchForm<{ ok: boolean; id: string; status: string }>("/api/payments/submit", form),

  joinWaitlist: (email: string) =>
    fetchJson<{ ok: boolean }>("/api/waitlist", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  adminMe: () => fetchJson<{ isAdmin: boolean }>("/api/admin/me"),

  adminPending: () =>
    fetchJson<{
      items: {
        id: string;
        userId: string;
        userEmail: string | null;
        planId: string;
        amount: number;
        trxId: string;
        receiptUrl: string | null;
        createdAt: string;
      }[];
    }>("/api/admin/pending"),

  adminReview: (id: string, action: "approve" | "reject") =>
    fetchJson<{ ok: boolean }>("/api/admin/review", {
      method: "POST",
      body: JSON.stringify({ id, action }),
    }),

  adminUser: (userId: string) =>
    fetchJson<{
      plan: string;
      expiresAt: string | null;
      expired: boolean;
      disabled: boolean;
      today: number;
      byModel: { modelId: string; requests: number; inputTokens: number; outputTokens: number }[];
    }>(`/api/admin/user?userId=${encodeURIComponent(userId)}`),

  adminSetPlan: (userId: string, planId: string, expiresAt: string | null) =>
    fetchJson<{ ok: boolean }>("/api/admin/plan", {
      method: "POST",
      body: JSON.stringify({ userId, planId, expiresAt }),
    }),

  adminDisable: (userId: string, disabled: boolean) =>
    fetchJson<{ ok: boolean }>("/api/admin/disable", {
      method: "POST",
      body: JSON.stringify({ userId, disabled }),
    }),

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
