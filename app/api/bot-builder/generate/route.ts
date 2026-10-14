import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { canUseBotBuilder } from "@/lib/bot-builder/access";
import { isClaudeConfigured } from "@/lib/claude";
import { isGitHubConnected, createRepoWithFiles } from "@/lib/github";
import { resolveBotBuilderModel } from "@/lib/bot-builder/requirements-agent";
import { fillTemplate, mergeTemplateWithFill } from "@/lib/bot-builder/template-filler";
import { isBotSpec } from "@/lib/bot-builder/types";
import { checkEntitlement } from "@/lib/entitlements";
import { logUsage } from "@/lib/usage";
import { logActivity } from "@/lib/activities";

export const dynamic = "force-dynamic";

const templateForBotType: Record<string, string> = {
  shop: "shop-bot",
  chat: "faq-bot",
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
  if (!canUseBotBuilder(user?.email)) {
    return NextResponse.json({ error: "Bot Builder is not enabled for this account" }, { status: 403 });
  }
  const userId = user!.id;

  if (!isClaudeConfigured()) {
    return NextResponse.json(
      { error: "No model configured", setupRequired: true },
      { status: 400 }
    );
  }
  if (!(await isGitHubConnected(userId, user!.email))) {
    return NextResponse.json(
      { error: "GitHub account is not connected", connectRequired: true },
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

    const repo = await createRepoWithFiles(userId, user!.email, spec.bot_name, allFiles);

    await logActivity({
      userId,
      workspaceId: null,
      type: "bot_builder",
      action: "bot_generated",
      title: `Generated bot "${spec.bot_name}" → ${repo.owner}/${repo.repo}`,
      // Structured so the projects panel can list generated bots without
      // re-parsing a human-readable title.
      detail: JSON.stringify({
        repo: `${repo.owner}/${repo.repo}`,
        bot_name: spec.bot_name,
        bot_type: spec.bot_type,
        warnings: warnings.length ? warnings : undefined,
      }),
      status: "success",
    });

    return NextResponse.json({
      repoUrl: repo.html_url,
      owner: repo.owner,
      repo: repo.repo,
      warnings,
      envVars: ["TELEGRAM_BOT_TOKEN", "ADMIN_CHAT_ID", "TELEGRAM_WEBHOOK_SECRET"],
      nextSteps: [
        {
          km: "Deploy repo នេះទៅ Vercel (Import Project → ជ្រើស repo នេះ)។ មិនចាំបាច់កំណត់ build step ទេ។",
          en: "Deploy this repo to Vercel (Import Project → pick this repo). No build step needed.",
        },
        {
          km: "ក្នុង Vercel project settings បន្ថែម env: TELEGRAM_BOT_TOKEN និង ADMIN_CHAT_ID។",
          en: "In the Vercel project settings add TELEGRAM_BOT_TOKEN and ADMIN_CHAT_ID.",
        },
        {
          km: "ណែនាំបន្ថែម TELEGRAM_WEBHOOK_SECRET ជា string ចៃដន្យវែងៗ — ការពារកុំឲ្យអ្នកដទៃបញ្ជូន order ក្លែងក្លាយមក admin។",
          en: "Recommended: add TELEGRAM_WEBHOOK_SECRET (a long random string) so nobody can POST fake orders to your admin.",
        },
        {
          km: "ហៅ setWebhook ម្ដង ដោយដាក់ url ជា https://<deployment>.vercel.app/api/webhook និង secret_token ដូចគ្នានឹង env ខាងលើ។",
          en: "Call setWebhook once with url=https://<deployment>.vercel.app/api/webhook and the same secret_token.",
        },
        {
          km: "សាកផ្ញើ /start ទៅ bot របស់អ្នក។",
          en: "Message your bot /start to test it.",
        },
      ],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Bot generation failed" }, { status: 500 });
  }
}
