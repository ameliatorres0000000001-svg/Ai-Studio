// The TeleScripts build pipeline: an idempotent, resumable state machine.
// Every external system comes in through BuilderDeps (lib/builder/live.ts in
// production, mocks in scripts/test-builder.mjs). Relative imports only.
//
// Rules:
// - Each step checks what already exists before acting, so re-running is safe.
// - Every step writes builder_events (started/done/retry/failed/waiting).
// - Event messages, run errors and audit rows go through redactSecrets.
// - Secrets (bot token, webhook secret, data JWT) are decrypted/minted only inside
//   deploy / set_webhook / smoke_test and never leave those functions.

import { redactSecrets, registerSecret } from "../redact";
import { isBotSpec } from "../bot-builder/types";
import { buildManagedBotLink, suggestBotUsername } from "./managed-bots";
import {
  STEPS,
  type BuilderDeps,
  type EnvVar,
  type EventStatus,
  type InstanceRow,
  type ProjectRow,
  type RunRow,
  type StepName,
} from "./types";

const LOCK_TTL_MS = 15 * 60_000;
export const MAX_AUTO_RETRIES = 2;
const DEFAULT_RETRY_DELAYS = [2_000, 8_000];
const DEFAULT_POLL_MS = 4_000;
const DEFAULT_DEPLOY_TIMEOUT_MS = 6 * 60_000;

/** Khmer progress copy shown in the UI timeline. */
export const STEP_LABEL: Record<StepName, string> = {
  requirements: "ពិនិត្យតម្រូវការ Bot",
  create_bot_link: "រៀបចំតំណបង្កើត Bot ក្នុង Telegram",
  await_managed_bot: "រង់ចាំការអនុញ្ញាតក្នុង Telegram",
  provision_repo: "រៀបចំរចនាសម្ព័ន្ធគម្រោង និងកូដ",
  provision_data: "បង្កើតមូលដ្ឋានទិន្នន័យ",
  deploy: "ដាក់ឲ្យដំណើរការលើ Cloud",
  set_webhook: "ភ្ជាប់ Webhook ទៅ Telegram",
  smoke_test: "ធ្វើតេស្តសាកល្បងស្វ័យប្រវត្តិ",
  handoff: "ប្រគល់ Bot ជូនម្ចាស់",
};

export class StepError extends Error {
  constructor(message: string, readonly retryable = true) {
    super(message);
    this.name = "StepError";
  }
}

interface Ctx {
  deps: BuilderDeps;
  run: RunRow;
  project: ProjectRow;
  emit(step: StepName, status: EventStatus, message: string): Promise<void>;
  instance(): Promise<InstanceRow>;
  refreshProject(): Promise<ProjectRow>;
}

type Outcome = "done" | "waiting" | { done: string };

function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  return redactSecrets(raw).slice(0, 1000);
}

function isRetryable(e: unknown): boolean {
  return !(e instanceof StepError) || e.retryable;
}

/** Vercel project names: lowercase letters, digits, '-', max 100. */
export function vercelProjectName(instanceId: string): string {
  return `ts-bot-${instanceId.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 12)}`;
}

function repoNameHint(project: ProjectRow, instanceId: string): string {
  const slug = project.name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `ts-${slug || "bot"}-${instanceId.replace(/-/g, "").slice(0, 8)}`;
}

function productsFrom(content: Record<string, unknown> | undefined) {
  const list = Array.isArray(content?.products) ? (content!.products as any[]) : [];
  return list
    .filter((p) => p && typeof p.name === "string" && Number.isFinite(Number(p.price)))
    .map((p) => ({
      name: String(p.name).slice(0, 200),
      price: Number(p.price),
      currency: (p.currency === "KHR" ? "KHR" : "USD") as "USD" | "KHR",
      ...(typeof p.description === "string" && p.description ? { description: p.description.slice(0, 1000) } : {}),
    }));
}

async function decryptRegistered(deps: BuilderDeps, payload: string | null, what: string): Promise<string> {
  if (!payload) throw new StepError(`${what} is missing`, false);
  const plain = deps.crypto.decrypt(payload);
  registerSecret(plain);
  return plain;
}

// ── Steps ───────────────────────────────────────────────────────────────────

const STEP_IMPL: Record<StepName, (ctx: Ctx) => Promise<Outcome>> = {
  async requirements({ project }) {
    if (!isBotSpec(project.requirements?.spec)) throw new StepError("Bot requirements are incomplete", false);
    return { done: `តម្រូវការរួចរាល់៖ ${project.name}` };
  },

  async create_bot_link({ deps, project }) {
    if (project.managed_link && project.pending_bot_username) return { done: "តំណបង្កើត Bot រួចរាល់" };
    const manager = deps.telegram.managerUsername();
    if (!manager) throw new StepError("TELEGRAM_MANAGER_BOT_USERNAME is not configured", false);
    const username = suggestBotUsername(project.name, deps.crypto.randomSecret());
    const link = buildManagedBotLink(manager, username, project.name);
    await deps.store.updateProject(project.id, { pending_bot_username: username, managed_link: link });
    return { done: `តំណបង្កើត Bot រួចរាល់ (@${username})` };
  },

  async await_managed_bot({ deps, project }) {
    const inst = await deps.store.getInstance(project.id);
    if (inst?.token_enc && inst.telegram_bot_id) return { done: `បានភ្ជាប់ Bot @${inst.username ?? inst.telegram_bot_id}` };
    return "waiting";
  },

  async provision_repo(ctx) {
    const { deps } = ctx;
    const project = await ctx.refreshProject();
    const inst = await ctx.instance();
    const built = await deps.templates.build(project.requirements, { botUsername: inst.username, projectId: project.id });
    if (built.usage && deps.onUsage) await deps.onUsage(project.user_id, built.usage);
    for (const w of built.warnings.slice(0, 5)) await ctx.emit("provision_repo", "info", `⚠ ${w}`);
    if (!project.requirements.configOverride && !project.requirements.filledConfig) {
      // Cache the AI fill so retries and redeploys produce the same code.
      await deps.store.updateProject(project.id, { requirements: { ...project.requirements, filledConfig: built.content } });
    }
    const repo = await deps.github.upsertRepo({
      existing: inst.github_repo,
      nameHint: repoNameHint(project, inst.id),
      files: built.files,
      message: `TeleScripts: build ${project.name}`,
    });
    await deps.store.upsertInstance(project.id, {
      github_repo: repo.fullName,
      repo_commit: repo.commit,
      status: inst.status === "linked" || inst.status === "pending" ? "provisioned" : inst.status,
    });
    return { done: `គម្រោងកូដរួចរាល់ (${repo.commit.slice(0, 7)})` };
  },

  async provision_data(ctx) {
    const project = await ctx.refreshProject();
    const inst = await ctx.instance();
    const content = project.requirements.configOverride ?? project.requirements.filledConfig;
    const products = project.template === "shop-bot" ? productsFrom(content) : [];
    await ctx.deps.data.provision(inst.id, products);
    return { done: `មូលដ្ឋានទិន្នន័យរួចរាល់ (${products.length} មុខទំនិញ)` };
  },

  async deploy(ctx) {
    const { deps, project } = ctx;
    let inst = await ctx.instance();
    if (!inst.github_repo || !inst.repo_commit) throw new StepError("Repository is not provisioned yet", false);
    const repoName = inst.github_repo;
    const commit = inst.repo_commit;
    const pollMs = deps.deployPollMs ?? DEFAULT_POLL_MS;
    const timeoutMs = deps.deployTimeoutMs ?? DEFAULT_DEPLOY_TIMEOUT_MS;

    const finalize = async (id: string, url: string) => {
      await deps.store.upsertInstance(project.id, { vercel_deployment_id: id, vercel_url: url.replace(/\/+$/, ""), deployed_commit: commit, deploying_commit: null, status: inst.status === "live" ? "live" : "deployed" });
      return { done: `ដាក់ឲ្យដំណើរការរួចរាល់ (${url.replace(/^https?:\/\//, "")})` };
    };

    const waitReady = async (id: string) => {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const d = await deps.vercel.getDeployment(id);
        if (d.state === "READY") {
          if (!d.url) throw new StepError("Deployment is READY but has no URL");
          return finalize(id, d.url);
        }
        if (d.state === "ERROR" || d.state === "CANCELED") throw new StepError(`Deployment ${d.state}${d.error ? `: ${d.error}` : ""}`);
        if (Date.now() >= deadline) throw new StepError("Deployment did not become READY in time");
        await deps.sleep(pollMs);
      }
    };

    // Resume: same commit already deployed or still building.
    if (inst.vercel_deployment_id && (inst.deployed_commit === inst.repo_commit || inst.deploying_commit === inst.repo_commit)) {
      const d = await deps.vercel.getDeployment(inst.vercel_deployment_id);
      if (d.state !== "ERROR" && d.state !== "CANCELED") {
        if (d.state === "READY" && d.url && inst.deployed_commit === inst.repo_commit) return { done: "ដាក់ឲ្យដំណើរការរួចហើយ (គ្មានការផ្លាស់ប្តូរ)" };
        return waitReady(inst.vercel_deployment_id);
      }
    }

    const token = await decryptRegistered(deps, inst.token_enc, "Bot token");
    let secretEnc = inst.webhook_secret_enc;
    if (!secretEnc) {
      secretEnc = deps.crypto.encrypt(deps.crypto.randomSecret());
      inst = await deps.store.upsertInstance(project.id, { webhook_secret_enc: secretEnc });
    }
    const webhookSecret = await decryptRegistered(deps, secretEnc, "Webhook secret");

    const vp = await deps.vercel.ensureProject({ existingId: inst.vercel_project_id, name: vercelProjectName(inst.id) });
    if (vp.id !== inst.vercel_project_id) inst = await deps.store.upsertInstance(project.id, { vercel_project_id: vp.id });

    const data = deps.data.runtimeEnv(inst.id);
    registerSecret(data.BOT_DATA_JWT);
    const admin = inst.owner_telegram_id ?? inst.creator_telegram_id;
    const env: EnvVar[] = [
      { key: "TELEGRAM_BOT_TOKEN", value: token, secret: true },
      { key: "TELEGRAM_WEBHOOK_SECRET", value: webhookSecret, secret: true },
      { key: "BOT_DATA_JWT", value: data.BOT_DATA_JWT, secret: true },
      { key: "SUPABASE_URL", value: data.SUPABASE_URL, secret: false },
      { key: "SUPABASE_ANON_KEY", value: data.SUPABASE_ANON_KEY, secret: false },
      { key: "BOT_ID", value: inst.id, secret: false },
      ...(admin != null ? [{ key: "ADMIN_CHAT_ID", value: String(admin), secret: false }] : []),
    ];
    await deps.vercel.setEnv(vp.id, env);
    await ctx.emit("deploy", "info", "បានកំណត់ការកំណត់សុវត្ថិភាព (encrypted env) រួចរាល់");

    const files = await deps.github.readFiles(repoName, commit);
    const dep = await deps.vercel.deploy({ projectId: vp.id, projectName: vp.name, files, commit });
    inst = await deps.store.upsertInstance(project.id, { vercel_deployment_id: dep.id, deploying_commit: commit, deployed_commit: null });
    await ctx.emit("deploy", "info", "កំពុង Build លើ Cloud...");
    return waitReady(dep.id);
  },

  async set_webhook(ctx) {
    const { deps, project } = ctx;
    const inst = await ctx.instance();
    if (!inst.vercel_url) throw new StepError("No deployment URL yet", false);
    const token = await decryptRegistered(deps, inst.token_enc, "Bot token");
    const secret = await decryptRegistered(deps, inst.webhook_secret_enc, "Webhook secret");
    await deps.telegram.setWebhook(token, `${inst.vercel_url}/api/webhook`, secret);
    if (project.template === "shop-bot") {
      try {
        await deps.telegram.setMiniAppMenu(token, `${inst.vercel_url}/`, "ហាង");
      } catch (e) {
        await ctx.emit("set_webhook", "info", `Mini App menu: ${errorMessage(e)}`);
      }
    }
    return { done: "Webhook ភ្ជាប់រួចរាល់" };
  },

  async smoke_test(ctx) {
    const { deps } = ctx;
    const inst = await ctx.instance();
    if (!inst.vercel_url) throw new StepError("No deployment URL yet", false);
    const health = await deps.http.health(`${inst.vercel_url}/api/health`);
    if (health.status === 401 || health.status === 403) throw new StepError("Deployment is protected (401/403) — disable Vercel deployment protection for production", false);
    const b = health.body || {};
    if (health.status !== 200 || !b.ok) throw new StepError(`Health check failed (HTTP ${health.status})`);
    const missing = ["telegram", "webhookSecret", "data"].filter((k) => !b[k]);
    if (missing.length) throw new StepError(`Runtime is missing configuration: ${missing.join(", ")}`);
    const token = await decryptRegistered(deps, inst.token_enc, "Bot token");
    const info = await deps.telegram.getWebhookInfo(token);
    if (info.url !== `${inst.vercel_url}/api/webhook`) throw new StepError("Telegram webhook URL does not match the deployment");
    if (info.last_error_message) await ctx.emit("smoke_test", "info", `Telegram: ${redactSecrets(info.last_error_message)}`);
    return { done: "តេស្តជោគជ័យ — Bot ឆ្លើយតបធម្មតា" };
  },

  async handoff(ctx) {
    const { deps, project } = ctx;
    const inst = await ctx.instance();
    const owner = inst.owner_telegram_id ?? inst.creator_telegram_id;
    await deps.store.upsertInstance(project.id, { owner_telegram_id: owner, status: "live" });
    await deps.store.updateProject(project.id, { status: "live" });
    if (owner != null) {
      const handle = inst.username ? `@${inst.username}` : project.name;
      const lines = [
        `🎉 Bot ${handle} របស់អ្នកដំណើរការហើយ!`,
        `• បើក Bot៖ https://t.me/${inst.username ?? ""}`,
        project.template === "shop-bot" ? `• Mini App៖ ${inst.vercel_url}/` : "",
        "• ការកុម្ម៉ង់ថ្មីៗនឹងផ្ញើមកអ្នកនៅទីនេះ។",
        "• Bot នេះជាកម្មសិទ្ធិរបស់អ្នក ១០០%។",
      ].filter(Boolean);
      try {
        await deps.telegram.sendManagerMessage(owner, lines.join("\n"));
      } catch (e) {
        await ctx.emit("handoff", "info", `មិនអាចផ្ញើសារជូនម្ចាស់បានទេ (${errorMessage(e)})`);
      }
    }
    return { done: `ប្រគល់ជូនម្ចាស់រួចរាល់ ${inst.username ? `@${inst.username}` : ""}`.trim() };
  },
};

// ── Engine ──────────────────────────────────────────────────────────────────

/**
 * Runs (or resumes) one run from its current step. Returns the final run row,
 * or null when another worker holds the lease. Never throws for step failures:
 * they end the run as `failed` with a redacted error.
 */
export async function runPipeline(runId: string, deps: BuilderDeps): Promise<RunRow | null> {
  const { store } = deps;
  if (!(await store.acquireLock(runId, LOCK_TTL_MS))) return null;
  try {
    const run = await store.getRun(runId);
    if (!run || run.status === "done") return run;
    let project = await store.getProject(run.project_id);
    if (!project) throw new Error("Project not found");

    const emit = async (step: StepName, status: EventStatus, message: string) => {
      await store.addEvent(runId, step, status, redactSecrets(message).slice(0, 2000));
    };
    const ctx: Ctx = {
      deps,
      run,
      project,
      emit,
      async instance() {
        const inst = await store.getInstance(project!.id);
        if (!inst) throw new StepError("Telegram bot is not linked yet", false);
        return inst;
      },
      async refreshProject() {
        project = (await store.getProject(run.project_id)) || project;
        ctx.project = project!;
        return project!;
      },
    };

    await store.updateRun(runId, { status: "running", error: null });
    await store.updateProject(project.id, { status: "building" });

    const delays = deps.retryDelaysMs ?? DEFAULT_RETRY_DELAYS;
    let retriesUsed = run.auto_retries;
    for (let idx = Math.max(0, STEPS.indexOf(run.step)); idx < STEPS.length; idx++) {
      const step = STEPS[idx];
      await store.updateRun(runId, { step });
      await emit(step, "started", STEP_LABEL[step]);
      let attempt = 0;
      let outcome: Outcome;
      for (;;) {
        try {
          await ctx.refreshProject();
          outcome = await STEP_IMPL[step](ctx);
          break;
        } catch (e) {
          const msg = errorMessage(e);
          if (attempt < MAX_AUTO_RETRIES && isRetryable(e)) {
            attempt++;
            retriesUsed++;
            await store.updateRun(runId, { auto_retries: retriesUsed });
            await emit(step, "retry", `ព្យាយាមម្តងទៀតដោយស្វ័យប្រវត្តិ (${attempt}/${MAX_AUTO_RETRIES}): ${msg}`);
            await deps.sleep(delays[Math.min(attempt - 1, delays.length - 1)] ?? 0);
            continue;
          }
          await emit(step, "failed", msg);
          await store.updateRun(runId, { status: "failed", error: msg, finished_at: new Date().toISOString() });
          await store.updateProject(project!.id, { status: "failed" });
          return await store.getRun(runId);
        }
      }
      if (outcome === "waiting") {
        await emit(step, "waiting", "សូមចុច «អនុញ្ញាត» ក្នុង Telegram ដើម្បីបង្កើត Bot");
        await store.updateRun(runId, { status: "waiting" });
        await store.updateProject(project!.id, { status: "waiting_bot" });
        return await store.getRun(runId);
      }
      await emit(step, "done", typeof outcome === "object" ? outcome.done : STEP_LABEL[step]);
    }

    await store.updateRun(runId, { status: "done", finished_at: new Date().toISOString() });
    return await store.getRun(runId);
  } catch (e) {
    const msg = errorMessage(e);
    await store.updateRun(runId, { status: "failed", error: msg, finished_at: new Date().toISOString() }).catch(() => undefined);
    return await store.getRun(runId).catch(() => null);
  } finally {
    await store.releaseLock(runId).catch(() => undefined);
  }
}

/** The run to continue for a project: the latest unfinished one, else a new one from `from`. */
export async function ensureRun(deps: Pick<BuilderDeps, "store">, projectId: string, from: StepName = "requirements"): Promise<RunRow> {
  const latest = await deps.store.latestRun(projectId);
  if (latest && latest.status !== "done" && latest.status !== "failed") return latest;
  return deps.store.createRun(projectId, from);
}

/** Repair: resume the latest failed run from its failed step with fresh retry counters. */
export async function prepareRepair(deps: Pick<BuilderDeps, "store">, projectId: string): Promise<RunRow | null> {
  const latest = await deps.store.latestRun(projectId);
  if (!latest || latest.status !== "failed") return null;
  await deps.store.updateRun(latest.id, { status: "queued", error: null, auto_retries: 0, attempts: latest.attempts + 1, finished_at: null });
  await deps.store.addEvent(latest.id, latest.step, "info", "កំពុងជួសជុល — ចាប់ផ្តើមឡើងវិញពីជំហានដែលបរាជ័យ");
  return deps.store.getRun(latest.id);
}

export class RunBusyError extends Error {
  constructor() {
    super("A build is already running for this bot");
    this.name = "RunBusyError";
  }
}

/** Start a fresh run from a later step (config change → provision_repo, token rotation → deploy). */
export async function restartFrom(deps: Pick<BuilderDeps, "store">, projectId: string, step: StepName): Promise<RunRow> {
  const latest = await deps.store.latestRun(projectId);
  if (latest && (latest.status === "running" || latest.status === "queued" || latest.status === "waiting")) throw new RunBusyError();
  return deps.store.createRun(projectId, step);
}
