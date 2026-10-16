// SERVER-ONLY. The platform agent ("dev superadmin") for ONE generated bot.
//
// - Runs through lib/agent/run.ts runToolAgent: no files, shell or web — only
//   the tools below, each bound to this project's id (no cross-tenant access).
// - Context = this project's name, template, status, config and build state.
//   Never tokens, secrets, encrypted columns, other projects or other users.
// - Every tool call (allowed or denied) is written to agent_audit_log.
// - Destructive tools (delete_project, change_env) need an admin approval
//   flag (lib/builder/approval.ts) that only ADMIN_EMAILS can set; the approval
//   is consumed when used. "Force redeploy of all bots" is not exposed to a
//   per-project agent at all.

import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { runToolAgent, type AgentEvent } from "@/lib/agent/run";
import type { ResolvedModel } from "@/lib/ai";
import { callBotApi } from "@/lib/telegram";
import { decryptSecret } from "@/lib/crypto";
import { redactSecrets, registerSecret } from "@/lib/redact";
import { supabaseStore } from "./store";
import { normalizeContent } from "./template-content";
import { restartFrom, RunBusyError } from "./pipeline";
import { kickRun } from "./live";
import { vercelAdapter } from "./vercel-platform";
import { isApproved, RESERVED_ENV_KEYS, type DestructiveAction } from "./approval";
import { isStepName, type ProjectRow } from "./types";

const RERUNNABLE = ["provision_repo", "provision_data", "deploy", "set_webhook", "smoke_test"] as const;
// The user's instruction is data; secrets pasted into it are refused at the route.
const SECRET_LIKE = /\b\d{6,12}:[A-Za-z0-9_-]{30,}\b|\b(sk|pk|ghp|gho|xox[abp])[-_][A-Za-z0-9_-]{16,}|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./;

export function containsSecret(text: string): boolean {
  return SECRET_LIKE.test(text);
}

const SYSTEM = `
You are the TeleScripts platform agent maintaining ONE customer's Telegram bot.
Strict rules:
- You can act only through the provided tools; they are scoped to this single bot.
- Never ask for, print or guess tokens, passwords, API keys or env values.
- Prefer small, safe changes: edit the bot configuration, then let the platform redeploy.
- Destructive tools need an admin approval; if a tool says approval is required, stop and explain.
- Reply to the owner in natural Khmer (short). Summarise what you changed.
`;

type Text = { content: { type: "text"; text: string }[]; isError?: boolean };
const ok = (v: unknown): Text => ({ content: [{ type: "text", text: redactSecrets(typeof v === "string" ? v : JSON.stringify(v)).slice(0, 8000) }] });
const err = (msg: string): Text => ({ content: [{ type: "text", text: redactSecrets(msg) }], isError: true });

export interface ProjectAgentResult {
  reply: string;
  actions: string[];
  usage: { inputTokens: number; outputTokens: number };
}

export async function runProjectAgent(opts: { projectId: string; actor: string; instruction: string; model: ResolvedModel; signal?: AbortSignal }): Promise<ProjectAgentResult> {
  const { projectId, actor } = opts;
  const actions: string[] = [];

  const audit = async (action: string, detail: unknown) => {
    await supabaseStore.audit({ actor, project_id: projectId, action, detail: redactSecrets(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 4000) });
  };
  const fresh = async (): Promise<ProjectRow> => {
    const p = await supabaseStore.getProject(projectId);
    if (!p || p.status === "deleted") throw new Error("Project not found");
    return p;
  };
  const consumeApproval = async (p: ProjectRow, action: DestructiveAction) => {
    await supabaseStore.updateProject(projectId, { approved_actions: (p.approved_actions || []).filter((a) => a !== action) });
  };
  const rerun = async (step: (typeof RERUNNABLE)[number]) => {
    const run = await restartFrom({ store: supabaseStore }, projectId, step);
    kickRun(run.id);
    return run.id;
  };

  const tools = [
    tool("get_project_status", "Status of this bot: build run, deployment state, public URL. No secrets.", {}, async () => {
      await audit("tool.get_project_status", {});
      const [p, inst, run] = await Promise.all([fresh(), supabaseStore.getInstance(projectId), supabaseStore.latestRun(projectId)]);
      return ok({ name: p.name, template: p.template, status: p.status, bot: inst ? { username: inst.username, status: inst.status, url: inst.vercel_url } : null, run: run ? { status: run.status, step: run.step, error: run.error } : null });
    }),

    tool("get_bot_config", "The bot's current configuration (products, prices, payment, texts).", {}, async () => {
      await audit("tool.get_bot_config", {});
      const p = await fresh();
      return ok(p.requirements.configOverride ?? p.requirements.filledConfig ?? null);
    }),

    tool("get_build_log", "The last 40 build/deploy log lines for this bot.", {}, async () => {
      await audit("tool.get_build_log", {});
      const run = await supabaseStore.latestRun(projectId);
      const events = run ? (await supabaseStore.listEvents(run.id)).slice(-40) : [];
      return ok(events.map((e) => `${e.step} ${e.status}: ${e.message}`).join("\n") || "(empty)");
    }),

    tool(
      "update_bot_config",
      "Replace the bot configuration with a full, valid config object (same shape as get_bot_config). The platform validates it, rebuilds and redeploys.",
      { config: z.record(z.string(), z.unknown()) },
      async ({ config }) => {
        const p = await fresh();
        const normalized = normalizeContent(p.template, config);
        if (!normalized) {
          await audit("tool.update_bot_config.rejected", "invalid config");
          return err("Invalid configuration — keep the same shape as get_bot_config.");
        }
        await supabaseStore.updateProject(projectId, { requirements: { ...p.requirements, configOverride: normalized } });
        let note = "saved";
        const inst = await supabaseStore.getInstance(projectId);
        if (inst && (inst.status === "deployed" || inst.status === "live")) {
          try {
            await rerun("provision_repo");
            note = "saved; rebuilding and redeploying";
          } catch (e) {
            if (!(e instanceof RunBusyError)) throw e;
            note = "saved; a build is already running and will need a rerun";
          }
        }
        await audit("tool.update_bot_config", note);
        actions.push(`បានកែការកំណត់ Bot (${note})`);
        return ok(note);
      }
    ),

    tool(
      "rerun_step",
      "Re-run this bot's pipeline from a step (provision_repo, provision_data, deploy, set_webhook, smoke_test). Use after fixing a failure.",
      { step: z.enum(RERUNNABLE) },
      async ({ step }) => {
        if (!isStepName(step)) return err("Unknown step");
        const latest = await supabaseStore.latestRun(projectId);
        if (latest?.status === "failed" && latest.step === step) {
          await supabaseStore.updateRun(latest.id, { status: "queued", error: null, auto_retries: 0, attempts: latest.attempts + 1, finished_at: null });
          kickRun(latest.id);
        } else {
          try {
            await rerun(step);
          } catch (e) {
            if (e instanceof RunBusyError) return err("A build is already running for this bot.");
            throw e;
          }
        }
        await audit("tool.rerun_step", { step });
        actions.push(`បានចាប់ផ្តើមឡើងវិញពី ${step}`);
        return ok(`re-running from ${step}`);
      }
    ),

    tool(
      "change_env",
      "DESTRUCTIVE (admin approval required): set a non-reserved runtime env var (e.g. PAYMENT_PROVIDER_TOKEN) and redeploy. Reserved keys are refused.",
      { key: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/), value: z.string().max(4000), secret: z.boolean().default(true) },
      async ({ key, value, secret }) => {
        const p = await fresh();
        if (RESERVED_ENV_KEYS.has(key)) {
          await audit("tool.change_env.denied", { key, reason: "reserved" });
          return err(`${key} is managed by the platform and cannot be changed.`);
        }
        if (!isApproved(p, "change_env")) {
          await audit("tool.change_env.denied", { key, reason: "approval required" });
          return err("Admin approval required for change_env.");
        }
        registerSecret(value);
        const inst = await supabaseStore.getInstance(projectId);
        if (!inst?.vercel_project_id) return err("Bot is not deployed yet.");
        await vercelAdapter.setEnv(inst.vercel_project_id, [{ key, value, secret }]);
        await supabaseStore.upsertInstance(projectId, { deployed_commit: null, deploying_commit: null });
        await consumeApproval(p, "change_env");
        await audit("tool.change_env", { key });
        try {
          await rerun("deploy");
        } catch (e) {
          if (!(e instanceof RunBusyError)) throw e;
        }
        actions.push(`បានកំណត់ ${key} ហើយកំពុងដាក់ឲ្យដំណើរការឡើងវិញ`);
        return ok(`${key} updated; redeploying`);
      }
    ),

    tool("delete_project", "DESTRUCTIVE (admin approval required): disable this bot — remove its webhook and hide the project.", { confirm: z.literal(true) }, async () => {
      const p = await fresh();
      if (!isApproved(p, "delete_project")) {
        await audit("tool.delete_project.denied", "approval required");
        return err("Admin approval required for delete_project.");
      }
      const inst = await supabaseStore.getInstance(projectId);
      if (inst?.token_enc) {
        const token = decryptSecret(inst.token_enc);
        registerSecret(token);
        await callBotApi(token, "deleteWebhook", { drop_pending_updates: true }).catch(() => undefined);
      }
      if (inst) await supabaseStore.upsertInstance(projectId, { status: "disabled" });
      await supabaseStore.updateProject(projectId, { status: "deleted", pending_bot_username: null });
      await consumeApproval(p, "delete_project");
      await audit("tool.delete_project", "webhook removed, project hidden");
      actions.push("បានបិទ Bot និងលាក់គម្រោង");
      return ok("project disabled");
    }),
  ];

  // Context for exactly one project — no secrets.
  const p = await fresh();
  const inst = await supabaseStore.getInstance(projectId);
  const context = {
    name: p.name,
    template: p.template,
    status: p.status,
    bot: inst ? { username: inst.username, status: inst.status, url: inst.vercel_url } : null,
    config: p.requirements.configOverride ?? p.requirements.filledConfig ?? null,
  };
  await audit("agent.start", { instruction: opts.instruction.slice(0, 500) });

  let reply = "";
  const usage = { inputTokens: 0, outputTokens: 0 };
  let failure: string | null = null;
  await runToolAgent({
    model: opts.model,
    serverName: "bot",
    tools,
    signal: opts.signal,
    system: `${SYSTEM}\n--- This bot (the only one you may touch) ---\n${redactSecrets(JSON.stringify(context)).slice(0, 12000)}`,
    prompt: opts.instruction,
    onEvent: (e: AgentEvent) => {
      if (e.type === "text_delta") reply += e.text;
      else if (e.type === "usage") { usage.inputTokens += e.inputTokens; usage.outputTokens += e.outputTokens; }
      else if (e.type === "error") failure = e.message;
      else if (e.type === "done" && e.isError) failure = e.errors.join(" · ") || "agent stopped";
    },
  });
  await audit("agent.finish", { actions, failure });
  return { reply: redactSecrets(reply.trim() || (failure ? `មានបញ្ហា៖ ${failure}` : "រួចរាល់។")), actions, usage };
}
