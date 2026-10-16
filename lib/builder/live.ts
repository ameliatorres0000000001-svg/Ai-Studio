// SERVER-ONLY. Wires the pipeline to the real systems and runs it in the
// background of this long-lived Node process (PM2, see docs/DEPLOY-VPS.md).
// Runs are resumable: any request (start, repair, webhook, events poll)
// re-kicks a run whose lease expired, so a server restart never loses a build.

import { encryptSecret, decryptSecret, randomSecret } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logUsage } from "@/lib/usage";
import { resolveBotBuilderModel } from "@/lib/bot-builder/requirements-agent";
import { redactSecrets } from "@/lib/redact";
import { supabaseStore } from "./store";
import { telegramAdapter } from "./telegram-manager";
import { githubAdapter } from "./github-platform";
import { vercelAdapter, probeHealth } from "./vercel-platform";
import { dataAdapter } from "./data";
import { templatesAdapter } from "./templates";
import { telegramIdFromEmail } from "./managed-bots";
import { runPipeline } from "./pipeline";
import type { BuilderDeps, RunRow } from "./types";

export function liveDeps(): BuilderDeps {
  return {
    store: supabaseStore,
    identity: {
      async telegramIdForUser(userId) {
        try {
          const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
          const u = data?.user;
          const meta = Number((u?.user_metadata as { telegram_id?: unknown } | undefined)?.telegram_id);
          return telegramIdFromEmail(u?.email) ?? (Number.isFinite(meta) && meta > 0 ? meta : null);
        } catch {
          return null;
        }
      },
    },
    telegram: telegramAdapter,
    github: githubAdapter,
    vercel: vercelAdapter,
    data: dataAdapter,
    templates: templatesAdapter,
    crypto: { encrypt: encryptSecret, decrypt: decryptSecret, randomSecret: () => randomSecret() },
    http: { health: probeHealth },
    async onUsage(userId, usage) {
      const model = resolveBotBuilderModel();
      if (model) await logUsage({ userId, workspaceId: null, model, purpose: "code", usage }).catch(() => undefined);
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}

const inFlight = new Set<string>();

/** Fire-and-forget: runs/resumes a run in this process. Safe to call repeatedly. */
export function kickRun(runId: string, deps: BuilderDeps = liveDeps()): void {
  if (inFlight.has(runId)) return;
  inFlight.add(runId);
  runPipeline(runId, deps)
    .catch((e) => console.error("builder run failed:", redactSecrets(e instanceof Error ? e.message : String(e))))
    .finally(() => inFlight.delete(runId));
}

/** Re-kick a run that should be progressing but has no live worker (e.g. after a restart). */
export function resumeIfStale(run: RunRow | null): void {
  if (!run || (run.status !== "running" && run.status !== "queued")) return;
  const free = !run.locked_until || new Date(run.locked_until).getTime() < Date.now();
  if (free) kickRun(run.id);
}
