import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { canUseBotBuilder } from "@/lib/bot-builder/access";
import { isClaudeConfigured } from "@/lib/claude";
import { resolveBotBuilderModel, runBotBuilderTurn } from "@/lib/bot-builder/requirements-agent";
import { checkEntitlement } from "@/lib/entitlements";
import { logUsage } from "@/lib/usage";
import type { BotBuilderMessage } from "@/lib/bot-builder/types";

export const dynamic = "force-dynamic";

const MAX_HISTORY = 40;

function isMessageArray(v: unknown): v is BotBuilderMessage[] {
  return (
    Array.isArray(v) &&
    v.every(
      (m) =>
        m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
  );
}

/**
 * One turn of the no-code "describe your bot" conversation. Stateless by
 * design: the client sends the prior history back each time, same as a normal
 * chat UI would hold it in component state. When the agent has gathered
 * enough information it returns `done: true` and a `spec` ready for
 * /api/bot-builder/generate. Login + admin required until the feature is
 * opened up; quota/plan enforced like every other model call.
 */
export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;
  if (!canUseBotBuilder(user?.email)) {
    return NextResponse.json({ error: "Bot Builder is not enabled for this account" }, { status: 403 });
  }

  if (!isClaudeConfigured()) {
    return NextResponse.json(
      { error: "No model configured", setupRequired: true },
      { status: 400 }
    );
  }
  const model = resolveBotBuilderModel();
  if (!model) {
    return NextResponse.json(
      { error: "Bot Builder needs an Anthropic-format model route configured" },
      { status: 400 }
    );
  }
  const entitlement = await checkEntitlement(user!.id, model.config.id, user!.email);
  if (!entitlement.allowed) {
    return NextResponse.json({ error: entitlement.messageEn }, { status: 429 });
  }

  try {
    const body = await req.json();
    const message = typeof body.message === "string" ? body.message : "";
    const history = isMessageArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];

    if (!message.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const result = await runBotBuilderTurn(model, history, message);
    if (result.usage) {
      await logUsage({ userId: user!.id, workspaceId: null, model, purpose: "code", usage: result.usage });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Bot builder chat failed" }, { status: 500 });
  }
}
