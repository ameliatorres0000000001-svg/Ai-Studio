// End-to-end proof of the TeleScripts builder pipeline against mocks.
//
// Real code under test (compiled from TypeScript on the fly, like test-quota):
//   lib/builder/pipeline.ts, managed-bots.ts, template-content.ts, types.ts,
//   lib/redact.ts, lib/crypto.ts, lib/bot-builder/{types,config}.ts
// Mocked: Telegram (manager + managed bot), GitHub, Vercel, Supabase store,
// the bot's /api/health. No network, no real tokens.
//
// Checks: link generation, managed_bot webhook (creator verification, encrypted
// token), every step end to end, auto-retry, failure + repair resume, idempotent
// reruns, token rotation redeploy, run lease, and that no secret appears in any
// event, run error, audit row or public payload.
//
// Run: node scripts/test-builder.mjs   (exit 0 = all checks pass)

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const nodeRequire = createRequire(import.meta.url);

process.env.CONNECTOR_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");

// ── Tiny TS loader for the dependency-free builder modules ──────────────────
const cache = new Map();
function loadTs(file) {
  const abs = path.resolve(file);
  if (cache.has(abs)) return cache.get(abs).exports;
  const src = fs.readFileSync(abs, "utf-8");
  const { outputText } = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  const mod = { exports: {} };
  cache.set(abs, mod);
  const req = (id) => {
    if (id.startsWith(".") || id.startsWith("@/")) {
      const base = id.startsWith("@/") ? path.join(root, id.slice(2)) : path.resolve(path.dirname(abs), id);
      if (base.endsWith(".json")) return nodeRequire(base);
      for (const cand of [`${base}.ts`, `${base}/index.ts`]) if (fs.existsSync(cand)) return loadTs(cand);
    }
    return nodeRequire(id);
  };
  new Function("require", "module", "exports", "process", outputText)(req, mod, mod.exports, process);
  return mod.exports;
}

const { runPipeline, ensureRun, prepareRepair, restartFrom, MAX_AUTO_RETRIES } = loadTs(path.join(root, "lib/builder/pipeline.ts"));
const { handleManagedBotUpdate, parseManagedBotUpdate, isValidBotUsername } = loadTs(path.join(root, "lib/builder/managed-bots.ts"));
const { assembleFiles, contentFromSpec, normalizeContent, templateFor } = loadTs(path.join(root, "lib/builder/template-content.ts"));
const { encryptSecret, decryptSecret, randomSecret, signJwtHs256 } = loadTs(path.join(root, "lib/crypto.ts"));
const { redactSecrets } = loadTs(path.join(root, "lib/redact.ts"));
const { isApproved, parseApproval, RESERVED_ENV_KEYS } = loadTs(path.join(root, "lib/builder/approval.ts"));
const { evaluateBotLimit } = loadTs(path.join(root, "lib/entitlements.ts"));

const results = [];
const check = (name, ok, extra = "") => results.push([name, !!ok, extra]);

// ── In-memory store ─────────────────────────────────────────────────────────
function memoryStore() {
  const db = { projects: new Map(), runs: new Map(), events: [], instances: new Map(), audit: [] };
  let eventId = 0;
  const clone = (v) => (v ? JSON.parse(JSON.stringify(v)) : null);
  const store = {
    db,
    async getProject(id) { return clone(db.projects.get(id)); },
    async updateProject(id, patch) { Object.assign(db.projects.get(id), clone(patch)); },
    async findProjectByPendingUsername(u) { return clone([...db.projects.values()].find((p) => (p.pending_bot_username || "").toLowerCase() === u.toLowerCase())); },
    async getRun(id) { return clone(db.runs.get(id)); },
    async latestRun(pid) { const r = [...db.runs.values()].filter((r) => r.project_id === pid); return clone(r[r.length - 1]); },
    async createRun(pid, step) { const r = { id: crypto.randomUUID(), project_id: pid, status: "queued", step, error: null, attempts: 0, auto_retries: 0, locked_until: null, started_at: new Date().toISOString(), finished_at: null }; db.runs.set(r.id, r); return clone(r); },
    async updateRun(id, patch) { Object.assign(db.runs.get(id), clone(patch)); },
    async acquireLock(id, ttl) { const r = db.runs.get(id); if (!r) return false; if (r.locked_until && new Date(r.locked_until).getTime() > Date.now()) return false; r.locked_until = new Date(Date.now() + ttl).toISOString(); return true; },
    async releaseLock(id) { const r = db.runs.get(id); if (r) r.locked_until = null; },
    async addEvent(run_id, step, status, message) { db.events.push({ id: ++eventId, run_id, step, status, message, created_at: new Date().toISOString() }); },
    async listEvents(run_id, after = 0) { return db.events.filter((e) => e.run_id === run_id && e.id > after); },
    async getInstance(pid) { return clone(db.instances.get(pid)); },
    async getInstanceByTelegramId(bid) { return clone([...db.instances.values()].find((i) => i.telegram_bot_id === bid)); },
    async upsertInstance(pid, patch) {
      const cur = db.instances.get(pid) || { id: crypto.randomUUID(), project_id: pid, telegram_bot_id: null, username: null, token_enc: null, webhook_secret_enc: null, creator_telegram_id: null, owner_telegram_id: null, github_repo: null, repo_commit: null, vercel_project_id: null, vercel_deployment_id: null, deploying_commit: null, deployed_commit: null, vercel_url: null, status: "pending" };
      Object.assign(cur, clone(patch));
      db.instances.set(pid, cur);
      return clone(cur);
    },
    async audit(e) { db.audit.push(clone(e)); },
  };
  return store;
}

// ── Mocks for external systems ──────────────────────────────────────────────
const MANAGER = "TeleScriptsManagerBot";
const BOT_TOKENS = new Map(); // managed bot id -> current token
const fakeToken = (id) => `${id}:AA${crypto.randomBytes(24).toString("base64url")}`;

function mocks(store, opts = {}) {
  const calls = { telegram: [], github: [], vercel: [], data: [], manager: [] };
  const repos = new Map(); // fullName -> { commits: [{sha, files}] }
  const projects = new Map(); // id -> { name, env: {} }
  const deployments = new Map(); // id -> { polls, files, env }
  const fail = { deploy: opts.deployFailures || 0, smoke: opts.smokeFailures || 0, leakToken: opts.leakToken || false };
  const webhooks = new Map(); // token -> {url, secret}
  const sha = (files) => crypto.createHash("sha1").update(JSON.stringify(files)).digest("hex");

  const deps = {
    store,
    identity: { async telegramIdForUser() { return opts.ownerTelegramId ?? null; } },
    telegram: {
      managerUsername: () => MANAGER,
      async getManagedBotToken(botId) { calls.manager.push(["getManagedBotToken", botId]); const t = BOT_TOKENS.get(botId); if (!t) throw new Error("bot not found"); return t; },
      async setWebhook(token, url, secret) { calls.telegram.push(["setWebhook", url]); webhooks.set(token, { url, secret }); },
      async getWebhookInfo(token) { return { url: webhooks.get(token)?.url || "" }; },
      async setMiniAppMenu(token, url) { calls.telegram.push(["setChatMenuButton", url]); },
      async sendManagerMessage(chatId, text) { calls.manager.push(["sendMessage", chatId, text]); },
    },
    github: {
      async upsertRepo({ existing, nameHint, files }) {
        const name = existing || `telescripts-bots/${nameHint}`;
        const repo = repos.get(name) || { commits: [] };
        repos.set(name, repo);
        const s = sha(files);
        const head = repo.commits[repo.commits.length - 1];
        if (!head || head.sha !== s) { repo.commits.push({ sha: s, files }); calls.github.push(["commit", name, s]); }
        return { fullName: name, url: `https://github.com/${name}`, commit: s };
      },
      async readFiles(name, commit) { return repos.get(name).commits.find((c) => c.sha === commit).files; },
    },
    vercel: {
      async ensureProject({ existingId, name }) { if (existingId && projects.has(existingId)) return { id: existingId, name: projects.get(existingId).name }; const id = `prj_${crypto.randomBytes(4).toString("hex")}`; projects.set(id, { name, env: {} }); calls.vercel.push(["createProject", name]); return { id, name }; },
      async setEnv(pid, vars) { for (const v of vars) projects.get(pid).env[v.key] = v.value; calls.vercel.push(["setEnv", vars.map((v) => v.key).sort().join(",")]); },
      async deploy({ projectId, projectName, files }) {
        if (fail.deploy > 0) { fail.deploy--; const t = projects.get(projectId).env.TELEGRAM_BOT_TOKEN; throw new Error(fail.leakToken ? `upstream exploded near bot${t}/getMe` : "Vercel API error (500)"); }
        const id = `dpl_${crypto.randomBytes(4).toString("hex")}`;
        deployments.set(id, { polls: 0, files, env: { ...projects.get(projectId).env }, url: `https://${projectName}.vercel.app` });
        calls.vercel.push(["deploy", id]);
        return { id };
      },
      async getDeployment(id) { const d = deployments.get(id); d.polls++; const state = d.polls < 3 ? (d.polls === 1 ? "QUEUED" : "BUILDING") : "READY"; return { id, state, url: state === "READY" ? d.url : null }; },
    },
    data: {
      async provision(botId, products) { calls.data.push(["provision", botId, products.length]); },
      runtimeEnv(botId) { return { SUPABASE_URL: "https://shared.supabase.co", SUPABASE_ANON_KEY: "anon-public-key", BOT_DATA_JWT: signJwtHs256({ role: "authenticated", bot_id: botId, exp: 9999999999 }, "test-jwt-secret-value") }; },
    },
    templates: {
      async build(req, ctx) {
        const template = templateFor(req.spec);
        const content = normalizeContent(template, req.configOverride ?? req.filledConfig ?? contentFromSpec(req.spec));
        const dir = path.join(root, "templates", template);
        const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [{ path: path.relative(dir, path.join(d, e.name)), content: fs.readFileSync(path.join(d, e.name), "utf-8") }]));
        return { template, files: assembleFiles(walk(dir), template, content, { botUsername: ctx.botUsername }), content, warnings: [], usage: { inputTokens: 10, outputTokens: 20 } };
      },
    },
    crypto: { encrypt: encryptSecret, decrypt: decryptSecret, randomSecret: () => randomSecret() },
    http: {
      async health(url) {
        if (fail.smoke > 0) { fail.smoke--; return { status: 503, body: null }; }
        const d = [...deployments.values()].find((x) => url.startsWith(x.url));
        if (!d) return { status: 404, body: null };
        return { status: 200, body: { ok: true, telegram: !!d.env.TELEGRAM_BOT_TOKEN, webhookSecret: !!d.env.TELEGRAM_WEBHOOK_SECRET, data: !!(d.env.BOT_DATA_JWT && d.env.SUPABASE_URL), admin: !!d.env.ADMIN_CHAT_ID } };
      },
    },
    usage: [],
    async onUsage(userId, u) { deps.usage.push([userId, u]); },
    sleep: async () => {},
    deployPollMs: 0,
    deployTimeoutMs: 60_000,
    retryDelaysMs: [0, 0],
  };
  return { deps, calls, repos, projects, deployments, webhooks };
}

const SPEC = {
  bot_type: "shop",
  bot_name: "Angkor Cafe",
  language: "km",
  description: "ហាងកាហ្វេ អង្គរ",
  products: [{ name: "Iced latte", price: 2.5, currency: "USD" }, { name: "នំខេក", price: 8000, currency: "KHR" }],
  payment_method: "manual",
  admin_telegram_username: "@angkor_owner",
};

function newProject(store, userId = "user-1") {
  const p = { id: crypto.randomUUID(), user_id: userId, name: SPEC.bot_name, template: "shop-bot", status: "draft", requirements: { spec: SPEC }, pending_bot_username: null, managed_link: null, approved_actions: [], approved_until: null, created_at: new Date().toISOString() };
  store.db.projects.set(p.id, p);
  return p;
}

const steps = (store, runId) => store.db.events.filter((e) => e.run_id === runId);

// ── 1. Happy path through the managed-bot handoff ───────────────────────────
async function happyPath() {
  const store = memoryStore();
  const OWNER_TG = 777001;
  const m = mocks(store, { ownerTelegramId: OWNER_TG });
  const project = newProject(store);

  let run = await ensureRun(m.deps, project.id);
  run = await runPipeline(run.id, m.deps);
  const p1 = await store.getProject(project.id);
  check("pipeline pauses at await_managed_bot", run.status === "waiting" && run.step === "await_managed_bot");
  check("project status waiting_bot", p1.status === "waiting_bot");
  check("link uses t.me/newbot/{manager}/{username}?name=", /^https:\/\/t\.me\/newbot\/TeleScriptsManagerBot\/[a-z0-9_]+_bot\?name=Angkor%20Cafe$/.test(p1.managed_link), p1.managed_link);
  check("suggested username is a valid bot username", isValidBotUsername(p1.pending_bot_username), p1.pending_bot_username);
  check("rerun while waiting stays waiting (idempotent link)", (await runPipeline(run.id, m.deps)).status === "waiting" && (await store.getProject(project.id)).managed_link === p1.managed_link);

  // Mock managed_bot update from someone else → rejected.
  const BOT_ID = 900100;
  BOT_TOKENS.set(BOT_ID, fakeToken(BOT_ID));
  const update = { update_id: 1, managed_bot: { user: { id: 123, first_name: "Mallory" }, bot: { id: BOT_ID, is_bot: true, first_name: "Angkor Cafe", username: p1.pending_bot_username } } };
  const parsed = parseManagedBotUpdate(update);
  check("managed_bot update parses", parsed && parsed.bot.id === BOT_ID);
  const expected = (proj) => m.deps.identity.telegramIdForUser(proj.user_id);
  const rejected = await handleManagedBotUpdate(parsed, m.deps, expected);
  check("update from a different Telegram user is rejected", rejected.kind === "rejected" && !(await store.getInstance(project.id))?.token_enc);

  // The real owner confirms in Telegram.
  update.managed_bot.user = { id: OWNER_TG, first_name: "Owner" };
  const linked = await handleManagedBotUpdate(parseManagedBotUpdate(update), m.deps, expected);
  const inst = await store.getInstance(project.id);
  const token = BOT_TOKENS.get(BOT_ID);
  check("owner's update links the bot", linked.kind === "linked" && inst.telegram_bot_id === BOT_ID);
  check("token stored encrypted (v1:…), never plaintext", inst.token_enc.startsWith("v1:") && !JSON.stringify(store.db).includes(token) && decryptSecret(inst.token_enc) === token);
  check("webhook secret generated + encrypted", inst.webhook_secret_enc?.startsWith("v1:"));
  check("unknown bot update is ignored", (await handleManagedBotUpdate({ user: { id: 1 }, bot: { id: 5, username: "nobody_bot" } }, m.deps, expected)).kind === "ignored");

  // Resume the run.
  run = await runPipeline(run.id, m.deps);
  const final = await store.getInstance(project.id);
  const ev = steps(store, run.id);
  check("run completes", run.status === "done", run.error || "");
  check("every step emitted started+done", ["requirements", "create_bot_link", "await_managed_bot", "provision_repo", "provision_data", "deploy", "set_webhook", "smoke_test", "handoff"].every((s) => ev.some((e) => e.step === s && e.status === "started") && ev.some((e) => e.step === s && e.status === "done")));
  check("repo committed with template + filled config", m.repos.get(final.github_repo)?.commits[0].files.some((f) => f.path === "config/bot.json" && f.content.includes("Iced latte")));
  check("generated repo contains no .env file", !m.repos.get(final.github_repo).commits[0].files.some((f) => /(^|\/)\.env/.test(f.path)));
  check("runtime.json carries the bot username", m.repos.get(final.github_repo).commits[0].files.some((f) => f.path === "config/runtime.json" && f.content.includes(p1.pending_bot_username)));
  check("data provisioned with 2 products", m.calls.data.some((c) => c[0] === "provision" && c[2] === 2));
  const env = m.projects.get(final.vercel_project_id).env;
  check("Vercel env gets token, secret, data JWT, admin chat", env.TELEGRAM_BOT_TOKEN === token && env.TELEGRAM_WEBHOOK_SECRET && env.BOT_DATA_JWT && env.ADMIN_CHAT_ID === String(OWNER_TG) && env.BOT_ID === final.id);
  check("deploy waited for READY and stored the URL", final.vercel_url?.endsWith(".vercel.app") && final.deployed_commit === final.repo_commit);
  check("setWebhook → <url>/api/webhook with secret", m.webhooks.get(token)?.url === `${final.vercel_url}/api/webhook` && m.webhooks.get(token).secret === decryptSecret(final.webhook_secret_enc));
  check("Mini App menu button set for shop bot", m.calls.telegram.some((c) => c[0] === "setChatMenuButton"));
  check("handoff: owner_telegram_id + live + Telegram message", final.owner_telegram_id === OWNER_TG && final.status === "live" && (await store.getProject(project.id)).status === "live" && m.calls.manager.some((c) => c[0] === "sendMessage" && c[1] === OWNER_TG));
  check("AI usage reported for the owner", m.deps.usage.length === 1 && m.deps.usage[0][0] === "user-1");
  check("filled config cached for deterministic reruns", !!(await store.getProject(project.id)).requirements.filledConfig);

  // Idempotent rerun from provision_repo: no new commit, no new deployment.
  const commitsBefore = m.calls.github.length, deploysBefore = m.calls.vercel.filter((c) => c[0] === "deploy").length;
  const rerun = await restartFrom(m.deps, project.id, "provision_repo");
  const rr = await runPipeline(rerun.id, m.deps);
  check("rerun is idempotent (no new commit / deployment)", rr.status === "done" && m.calls.github.length === commitsBefore && m.calls.vercel.filter((c) => c[0] === "deploy").length === deploysBefore);

  // Owner edits config → new commit + redeploy.
  await store.updateProject(project.id, { requirements: { ...(await store.getProject(project.id)).requirements, configOverride: { ...contentFromSpec(SPEC), products: [{ name: "Mocha", price: 3, currency: "USD" }] } } });
  const edit = await runPipeline((await restartFrom(m.deps, project.id, "provision_repo")).id, m.deps);
  check("config edit → new commit + redeploy", edit.status === "done" && m.calls.github.length === commitsBefore + 1 && m.calls.vercel.filter((c) => c[0] === "deploy").length === deploysBefore + 1);

  // Token rotation (ManagedBotUpdated again) → token_enc changes, redeploy carries the new token.
  const rotated = fakeToken(BOT_ID);
  BOT_TOKENS.set(BOT_ID, rotated);
  const rot = await handleManagedBotUpdate(parseManagedBotUpdate({ managed_bot: { user: { id: OWNER_TG }, bot: { id: BOT_ID, username: p1.pending_bot_username } } }), m.deps, expected);
  const afterRot = await store.getInstance(project.id);
  check("token rotation detected + re-encrypted", rot.kind === "token_rotated" && decryptSecret(afterRot.token_enc) === rotated && afterRot.deployed_commit === null);
  const rotRun = await runPipeline((await restartFrom(m.deps, project.id, "deploy")).id, m.deps);
  check("rotation redeploy injects the new token", rotRun.status === "done" && m.projects.get(afterRot.vercel_project_id).env.TELEGRAM_BOT_TOKEN === rotated && m.webhooks.has(rotated));

  // Run lease: a second worker cannot take a held run.
  const lockRun = await store.createRun(project.id, "smoke_test");
  await store.acquireLock(lockRun.id, 60_000);
  check("run lease blocks a concurrent worker", (await runPipeline(lockRun.id, m.deps)) === null);
  await store.releaseLock(lockRun.id);

  return { store, secrets: [token, rotated, decryptSecret(final.webhook_secret_enc), env.BOT_DATA_JWT] };
}

// ── 2. Auto-retry, failure, repair, and redaction of a leaky upstream error ─
async function failureAndRepair() {
  const store = memoryStore();
  const m = mocks(store, { deployFailures: 2, smokeFailures: MAX_AUTO_RETRIES + 1, leakToken: true });
  const project = newProject(store, "user-2");
  const BOT_ID = 900200;
  BOT_TOKENS.set(BOT_ID, fakeToken(BOT_ID));
  let run = await runPipeline((await ensureRun(m.deps, project.id)).id, m.deps);
  const p = await store.getProject(project.id);
  await handleManagedBotUpdate({ user: { id: 42 }, bot: { id: BOT_ID, username: p.pending_bot_username } }, m.deps, async () => null);
  run = await runPipeline(run.id, m.deps);
  const ev = steps(store, run.id);
  check("deploy auto-retried twice then succeeded", ev.filter((e) => e.step === "deploy" && e.status === "retry").length === 2 && ev.some((e) => e.step === "deploy" && e.status === "done"));
  check("smoke test fails after max automatic retries", run.status === "failed" && run.step === "smoke_test" && ev.filter((e) => e.step === "smoke_test" && e.status === "retry").length === MAX_AUTO_RETRIES);
  check("project marked failed with a redacted error", (await store.getProject(project.id)).status === "failed" && !!run.error);
  const deploysBefore = m.calls.vercel.filter((c) => c[0] === "deploy").length;
  const repaired = await prepareRepair(m.deps, project.id);
  check("repair resumes the same run from the failed step", repaired.id === run.id && repaired.status === "queued" && repaired.step === "smoke_test");
  run = await runPipeline(run.id, m.deps);
  check("repair completes without redeploying", run.status === "done" && m.calls.vercel.filter((c) => c[0] === "deploy").length === deploysBefore);
  check("repair of a healthy project is refused", (await prepareRepair(m.deps, project.id)) === null);
  return { store, secrets: [BOT_TOKENS.get(BOT_ID), decryptSecret((await store.getInstance(project.id)).webhook_secret_enc)] };
}

// ── 3. FAQ template + unit checks ───────────────────────────────────────────
function units() {
  const faqSpec = { bot_type: "chat", bot_name: "Clinic FAQ", language: "km", description: "", payment_method: "manual", faq: [{ question: "ម៉ោងបើក?", answer: "៨ ព្រឹក", keywords: ["ម៉ោង"] }] };
  check("chat spec → faq-bot template", templateFor(faqSpec) === "faq-bot");
  check("faq content normalizes", normalizeContent("faq-bot", contentFromSpec(faqSpec))?.questions.length === 1);
  check("invalid shop config is rejected", normalizeContent("shop-bot", { botName: "", products: [] }) === null);
  const tok = "123456789:AAH8f3kD9sLx0QwErTyUiOpAsDfGhJkLzXc";
  check("redact: bot token in URL", !redactSecrets(`POST https://api.telegram.org/bot${tok}/getMe failed`).includes(tok));
  const jwt = signJwtHs256({ role: "authenticated", bot_id: "b1", exp: 1 }, "s3cret-s3cret");
  check("redact: JWT", !redactSecrets(`env BOT_DATA_JWT=${jwt}`).includes(jwt));
  const [h, pl, sig] = jwt.split(".");
  const expectSig = crypto.createHmac("sha256", "s3cret-s3cret").update(`${h}.${pl}`).digest("base64url");
  check("HS256 JWT signature verifies", sig === expectSig && JSON.parse(Buffer.from(pl, "base64url")).bot_id === "b1");
  check("randomSecret fits Telegram secret_token charset", /^[A-Za-z0-9_-]{1,256}$/.test(randomSecret()));
}

// ── 4. Admin approval gate + per-plan bot limit (Phase F) ──────────────────
function gates() {
  const now = Date.now();
  const future = new Date(now + 10 * 60_000).toISOString();
  const past = new Date(now - 1000).toISOString();
  check("destructive action denied without approval", !isApproved({ approved_actions: [], approved_until: null }, "delete_project", now));
  check("approval for another action does not count", !isApproved({ approved_actions: ["change_env"], approved_until: future }, "delete_project", now));
  check("expired approval is denied", !isApproved({ approved_actions: ["delete_project"], approved_until: past }, "delete_project", now));
  check("live admin approval allows the action", isApproved({ approved_actions: ["delete_project"], approved_until: future }, "delete_project", now));
  check("approval request rejects non-destructive actions", "error" in parseApproval({ actions: ["update_bot_config"] }));
  check("approval window is capped at 60 minutes", parseApproval({ actions: ["change_env"], minutes: 600 }).minutes === 60);
  check("bot token / data JWT env keys are reserved", RESERVED_ENV_KEYS.has("TELEGRAM_BOT_TOKEN") && RESERVED_ENV_KEYS.has("BOT_DATA_JWT"));
  check("free plan: 1 bot allowed, 2nd refused", evaluateBotLimit({ planId: "free", activeBots: 0, isAdmin: false }).allowed && !evaluateBotLimit({ planId: "free", activeBots: 1, isAdmin: false }).allowed);
  check("pro plan allows 5 bots", evaluateBotLimit({ planId: "pro", activeBots: 4, isAdmin: false }).allowed && !evaluateBotLimit({ planId: "pro", activeBots: 5, isAdmin: false }).allowed);
  check("admins are unlimited", evaluateBotLimit({ planId: "free", activeBots: 99, isAdmin: true }).allowed);
}

function noSecretsAnywhere(label, store, secrets) {
  const surfaces = JSON.stringify({ events: store.db.events, runs: [...store.db.runs.values()], audit: store.db.audit, projects: [...store.db.projects.values()] });
  const leaked = secrets.filter((s) => s && surfaces.includes(s));
  check(`${label}: no secret in events / run errors / audit / project rows`, leaked.length === 0, leaked.length ? `${leaked.length} leaked` : "");
}

const a = await happyPath();
noSecretsAnywhere("happy path", a.store, a.secrets);
const b = await failureAndRepair();
noSecretsAnywhere("failure path (leaky upstream error)", b.store, b.secrets);
units();
gates();

let failed = 0;
for (const [name, ok, extra] of results) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && extra ? `  — ${extra}` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
