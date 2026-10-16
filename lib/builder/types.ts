// Shared types for the TeleScripts builder pipeline. Type-only except the
// STEPS list, so it loads anywhere (API routes, pipeline, test script).

import type { BotSpec } from "../bot-builder/types";

export const STEPS = [
  "requirements",
  "create_bot_link",
  "await_managed_bot",
  "provision_repo",
  "provision_data",
  "deploy",
  "set_webhook",
  "smoke_test",
  "handoff",
] as const;

export type StepName = (typeof STEPS)[number];

export function isStepName(v: unknown): v is StepName {
  return typeof v === "string" && (STEPS as readonly string[]).includes(v);
}

export type TemplateName = "shop-bot" | "faq-bot";
export type ProjectStatus = "draft" | "building" | "waiting_bot" | "live" | "failed" | "deleted";
export type RunStatus = "queued" | "running" | "waiting" | "failed" | "done";
export type EventStatus = "started" | "done" | "failed" | "waiting" | "info" | "retry";
export type InstanceStatus = "pending" | "linked" | "provisioned" | "deployed" | "live" | "failed" | "disabled";

/** What the builder stores in builder_projects.requirements. Never contains secrets. */
export interface Requirements {
  spec: BotSpec;
  /** Owner edits from the Settings tab (validated config/bot.json); wins over the AI fill. */
  configOverride?: Record<string, unknown>;
  /** The AI-filled content file, cached after the first build so reruns are deterministic. */
  filledConfig?: Record<string, unknown>;
}

export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  template: TemplateName;
  status: ProjectStatus;
  requirements: Requirements;
  pending_bot_username: string | null;
  managed_link: string | null;
  approved_actions: string[];
  approved_until: string | null;
  created_at: string;
  updated_at?: string;
}

export interface RunRow {
  id: string;
  project_id: string;
  status: RunStatus;
  step: StepName;
  error: string | null;
  attempts: number;
  auto_retries: number;
  locked_until: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface EventRow {
  id: number;
  run_id: string;
  step: StepName;
  status: EventStatus;
  message: string;
  created_at: string;
}

export interface InstanceRow {
  id: string;
  project_id: string;
  telegram_bot_id: number | null;
  username: string | null;
  token_enc: string | null;
  webhook_secret_enc: string | null;
  creator_telegram_id: number | null;
  owner_telegram_id: number | null;
  github_repo: string | null;
  repo_commit: string | null;
  vercel_project_id: string | null;
  vercel_deployment_id: string | null;
  deploying_commit: string | null;
  deployed_commit: string | null;
  vercel_url: string | null;
  status: InstanceStatus;
}

export interface AuditEntry {
  actor: string;
  project_id: string | null;
  action: string;
  detail: string;
}

/** Persistence used by the pipeline. Supabase in production, in-memory in scripts/test-builder.mjs. */
export interface BuilderStore {
  getProject(id: string): Promise<ProjectRow | null>;
  updateProject(id: string, patch: Partial<ProjectRow>): Promise<void>;
  findProjectByPendingUsername(username: string): Promise<ProjectRow | null>;
  getRun(id: string): Promise<RunRow | null>;
  latestRun(projectId: string): Promise<RunRow | null>;
  createRun(projectId: string, step: StepName): Promise<RunRow>;
  updateRun(id: string, patch: Partial<RunRow>): Promise<void>;
  /** Atomically takes the run lease if it is free or expired. */
  acquireLock(runId: string, ttlMs: number): Promise<boolean>;
  releaseLock(runId: string): Promise<void>;
  addEvent(runId: string, step: StepName, status: EventStatus, message: string): Promise<void>;
  listEvents(runId: string, afterId?: number): Promise<EventRow[]>;
  getInstance(projectId: string): Promise<InstanceRow | null>;
  getInstanceByTelegramId(botId: number): Promise<InstanceRow | null>;
  upsertInstance(projectId: string, patch: Partial<InstanceRow>): Promise<InstanceRow>;
  audit(entry: AuditEntry): Promise<void>;
}

export interface RepoFile {
  path: string;
  content: string;
}

export interface DeploymentInfo {
  id: string;
  state: "QUEUED" | "INITIALIZING" | "BUILDING" | "READY" | "ERROR" | "CANCELED" | string;
  /** Stable production URL (alias) when available, else the deployment URL. */
  url: string | null;
  error?: string | null;
}

export interface EnvVar {
  key: string;
  value: string;
  secret: boolean;
}

/** External systems, injected so the pipeline is testable end to end against mocks. */
export interface BuilderDeps {
  store: BuilderStore;
  /** The platform user's Telegram id when known (Telegram login); used to verify the bot creator. */
  identity?: { telegramIdForUser(userId: string): Promise<number | null> };
  telegram: {
    managerUsername(): string;
    getManagedBotToken(botUserId: number): Promise<string>;
    setWebhook(token: string, url: string, secretToken: string): Promise<void>;
    getWebhookInfo(token: string): Promise<{ url: string; last_error_message?: string; last_error_date?: number }>;
    setMiniAppMenu(token: string, url: string, text: string): Promise<void>;
    sendManagerMessage(chatId: number, text: string): Promise<void>;
  };
  github: {
    /** Creates (or updates) the bot repo under the platform account; returns the head commit. */
    upsertRepo(opts: { existing: string | null; nameHint: string; files: RepoFile[]; message: string }): Promise<{ fullName: string; url: string; commit: string }>;
    /** Every file of the repo at a commit (what gets deployed). */
    readFiles(fullName: string, commit: string): Promise<RepoFile[]>;
  };
  vercel: {
    ensureProject(opts: { existingId: string | null; name: string }): Promise<{ id: string; name: string }>;
    setEnv(projectId: string, vars: EnvVar[]): Promise<void>;
    deploy(opts: { projectId: string; projectName: string; files: RepoFile[]; commit: string }): Promise<{ id: string }>;
    getDeployment(id: string): Promise<DeploymentInfo>;
  };
  data: {
    provision(botId: string, products: { name: string; price: number; currency: "USD" | "KHR"; description?: string }[]): Promise<void>;
    runtimeEnv(botId: string): { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; BOT_DATA_JWT: string };
  };
  templates: {
    build(req: Requirements, ctx: { botUsername: string | null; projectId: string }): Promise<{
      template: TemplateName;
      files: RepoFile[];
      /** The parsed content file (config/bot.json or config/faq.json) that went into the repo. */
      content: Record<string, unknown>;
      warnings: string[];
      usage?: { inputTokens: number; outputTokens: number };
    }>;
  };
  crypto: {
    encrypt(plain: string): string;
    decrypt(payload: string): string;
    randomSecret(): string;
  };
  http: {
    health(url: string): Promise<{ status: number; body: any }>;
  };
  /** Called after a model call so usage is logged against the project owner. */
  onUsage?(userId: string, usage: { inputTokens: number; outputTokens: number }): Promise<void>;
  sleep(ms: number): Promise<void>;
  /** Poll cadence/timeout for Vercel READY (tests shrink these). */
  deployPollMs?: number;
  deployTimeoutMs?: number;
  retryDelaysMs?: number[];
}

/** Browser-safe project view returned by /api/builder/* (never tokens, secrets or encrypted columns). */
export interface PublicProject {
  id: string;
  name: string;
  template: TemplateName;
  status: ProjectStatus;
  createdAt: string;
  spec: BotSpec | null;
  config: Record<string, unknown> | null;
  managedLink: string | null;
  suggestedUsername: string | null;
  bot: { username: string | null; status: InstanceStatus; url: string | null; miniAppUrl: string | null; linked: boolean } | null;
  run: { id: string; status: RunStatus; step: StepName; error: string | null; startedAt: string; finishedAt: string | null } | null;
  ordersToday?: number;
}

export interface PublicEvent {
  id: number;
  runId: string;
  step: StepName;
  status: EventStatus;
  message: string;
  createdAt: string;
}
