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
  username: string;
  avatar_url: string | null;
  connected_at: string;
  last_synced_at: string | null;
}

export interface Workspace {
  id: string;
  repo_full_name: string;
  repo_default_branch: string;
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
  workspace_id: string | null;
  type: string;
  title: string;
  detail: string | null;
  status: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  workspace_id: string;
  role: "user" | "assistant";
  content: string;
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

export interface ApiError {
  error: string;
  setupRequired?: boolean;
  envVars?: string[];
}
