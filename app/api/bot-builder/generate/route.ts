import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";
import { isClaudeConfigured } from "@/lib/claude";
import { isGitHubConfigured, createRepoWithFiles } from "@/lib/github";
import { resolveBotBuilderModel } from "@/lib/bot-builder/requirements-agent";
import { fillTemplate, mergeTemplateWithFill } from "@/lib/bot-builder/template-filler";
import { isBotSpec } from "@/lib/bot-builder/types";
import { checkEntitlement } from "@/lib/entitlements";
import { logUsage } from "@/lib/usage";
import { logActivity } from "@/lib/activities";

export const dynamic = "force-dynamic";

const templateForBotType: Record<string, string> = {
  shop: "shop-bot",
  chat: "shop-bot",
  booking: "shop-bot",
  miniapp: "shop-bot",
};

/**
 * Takes a finished BotSpec (from /api/bot-builder/chat), fills the matching
 * template's config file, and creates a brand-new private GitHub repo with the
 * result. Login + admin required until the feature is opened up. The user
 * still deploys that repo to Vercel and runs setWebhook themselves (see the
 * generated repo's README.md) — this route only produces the code.
 */
export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "Bot Builder is admin-only for now" }, { status: 403 });
  }
  const userId = user!.id;

  if (!isClaudeConfigured()) {
    return NextResponse.json(
      { error: "No model configured", setupRequired: true },
      { status: 400 }
    );
  }
  if (!isGitHubConfigured()) {
    return NextResponse.json(
      { error: "GitHub not configured", setupRequired: true, envVars: ["GITHUB_ACCESS_TOKEN"] },
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
  const entitlement = await checkEntitlement(userId, model.config.id, user!.email);
  if (!entitlement.allowed) {
    return NextResponse.json({ error: entitlement.messageEn }, { status: 429 });
  }

  try {
    const body = await req.json();
    if (!isBotSpec(body.spec)) {
      return NextResponse.json({ error: "A valid spec is required" }, { status: 400 });
    }
    const spec = body.spec;

    const { files: filledFiles, warnings, usage } = await fillTemplate(model, spec);
    await logUsage({ userId, workspaceId: null, model, purpose: "code", usage });
    const templateName = templateForBotType[spec.bot_type] || "shop-bot";
    const allFiles = mergeTemplateWithFill(templateName, filledFiles);

    const repo = await createRepoWithFiles(spec.bot_name, allFiles);

    await logActivity({
      userId,
      workspaceId: null,
      type: "bot_builder",
      action: "bot_generated",
      title: `Generated bot "${spec.bot_name}" → ${repo.owner}/${repo.repo}`,
      detail: warnings.length ? `Warnings: ${warnings.join("; ")}` : null,
      status: "success",
    });

    return NextResponse.json({
      repoUrl: repo.html_url,
      owner: repo.owner,
      repo: repo.repo,
      warnings,
      nextSteps: [
        "Deploy the new repo to Vercel.",
        "Set TELEGRAM_BOT_TOKEN (and ADMIN_CHAT_ID) in the Vercel project's environment variables.",
        "Call Telegram's setWebhook once, pointing at https://<your-deployment>.vercel.app/api/webhook.",
        "Message your bot /start to test it.",
      ],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Bot generation failed" }, { status: 500 });
  }
}
