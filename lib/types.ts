export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  default_branch: string;
  private: boolean;
  description: string | null;
  html_url: string;
  updated_at: string | null;
  language: string | null;
}

export interface GitHubConnection {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  connected_at: string;
  last_synced_at: string | null;
}

export interface Workspace {
  id: string;
  user_id: string;
  repo_full_name: string;
  repo_default_branch: string;
  repo_description: string | null;
  repo_language: string | null;
  repo_private: boolean;
  repo_html_url: string | null;
  local_path: string;
  status: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
}

export interface Activity {
  id: string;
  user_id: string;
  workspace_id: string | null;
  type: string;
  action: string | null;
  title: string;
  detail: string | null;
  prompt: string | null;
  files_changed: string[] | null;
  command: string | null;
  test_result: string | null;
  error: string | null;
  status: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  user_id?: string;
  workspace_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ClaudeSession {
  id: string;
  user_id: string;
  workspace_id: string;
  status: "active" | "completed" | "error";
  prompt: string | null;
  result_summary: string | null;
  files_changed: string[] | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface Deployment {
  id: string;
  user_id: string;
  workspace_id: string;
  platform: "vercel" | "railway";
  status: "pending" | "success" | "failed";
  url: string | null;
  error: string | null;
  external_id?: string | null;
  target?: "preview" | "production" | null;
  created_at: string;
}

export interface ClaudeResult {
  response: string;
  filesChanged: string[];
  diff: string | null;
  success: boolean;
  error?: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

/** Telegram connector (optional). "connecting" is a client-side transient state only. */
export type TelegramState = "not_connected" | "connected" | "error" | "disconnected";

export interface TelegramStatus {
  state: TelegramState;
  /** True when TELEGRAM_BOT_TOKEN is set on the server (the value itself is never exposed). */
  configured: boolean;
  bot: { id: number; username: string | null; name: string | null } | null;
  chat: { id: string; title: string | null } | null;
  connectedAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  /** Connection metadata could not be read (e.g. migration not applied); treated as not connected. */
  unavailable?: boolean;
}

export interface ApiError {
  error: string;
  setupRequired?: boolean;
  envVars?: string[];
}
