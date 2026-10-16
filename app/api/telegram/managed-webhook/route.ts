import crypto from "crypto";
import { NextResponse } from "next/server";
import { handleManagedBotUpdate, parseManagedBotUpdate } from "@/lib/builder/managed-bots";
import { kickRun, liveDeps } from "@/lib/builder/live";
import { restartFrom, RunBusyError } from "@/lib/builder/pipeline";
import { redactSecrets } from "@/lib/redact";

export const dynamic = "force-dynamic";

function trusted(req: Request): boolean {
  const expected = process.env.TELEGRAM_MANAGED_WEBHOOK_SECRET?.trim();
  if (!expected) return false;
  const got = req.headers.get("x-telegram-bot-api-secret-token") || "";
  const a = Buffer.from(got), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Manager-bot webhook (Bot Management Mode). Verifies Telegram's secret_token
 * header, then handles `managed_bot` updates: stores the new bot's token
 * (encrypted) and resumes the waiting build, or redeploys on token/owner change.
 * Responds 200 for anything it does not handle; 500 makes Telegram retry.
 */
export async function POST(req: Request) {
  if (!trusted(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }
  const mb = parseManagedBotUpdate(update);
  if (!mb) return NextResponse.json({ ok: true });

  const deps = liveDeps();
  try {
    const outcome = await handleManagedBotUpdate(mb, deps, async (project) =>
      deps.identity ? deps.identity.telegramIdForUser(project.user_id) : null
    );

    if (outcome.kind === "linked") {
      const run = await deps.store.latestRun(outcome.projectId);
      if (run && (run.status === "waiting" || run.status === "queued")) {
        await deps.store.addEvent(run.id, "await_managed_bot", "info", `Telegram បានអនុញ្ញាត @${outcome.username ?? ""}`);
        kickRun(run.id, deps);
      }
    } else if (outcome.kind === "token_rotated" || outcome.kind === "owner_changed") {
      const inst = await deps.store.getInstance(outcome.projectId);
      if (inst && (inst.status === "deployed" || inst.status === "live")) {
        try {
          const run = await restartFrom(deps, outcome.projectId, "deploy");
          kickRun(run.id, deps);
        } catch (e) {
          if (!(e instanceof RunBusyError)) throw e;
          // A build is already running; it will pick up the new token at its deploy step.
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("managed-webhook:", redactSecrets(e instanceof Error ? e.message : String(e)));
    return NextResponse.json({ error: "temporary failure" }, { status: 500 });
  }
}
