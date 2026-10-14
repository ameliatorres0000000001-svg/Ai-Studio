import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { canUseBotBuilder } from "@/lib/bot-builder/access";
import { isGitHubConnected, getRepoFile, putRepoFile } from "@/lib/github";
import { parseBotConfig, serializeBotConfig, type BotConfig } from "@/lib/bot-builder/config";
import { logActivity } from "@/lib/activities";

export const dynamic = "force-dynamic";

/** The one file a generated bot's owner may edit from the studio. */
const CONFIG_PATH = "config/bot.json";

const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;

function splitRepo(value: unknown): { owner: string; repo: string } | null {
  if (typeof value !== "string" || !REPO_RE.test(value)) return null;
  const [owner, repo] = value.split("/");
  return { owner, repo };
}

function notEnabled() {
  return NextResponse.json({ error: "Bot Builder is not enabled for this account" }, { status: 403 });
}

/** Reads a generated bot's current catalogue straight out of its repo. */
export async function GET(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;
  if (!canUseBotBuilder(user?.email)) return notEnabled();
  if (!(await isGitHubConnected(user!.id, user!.email))) {
    return NextResponse.json({ error: "GitHub account is not connected", connectRequired: true }, { status: 400 });
  }

  const target = splitRepo(new URL(req.url).searchParams.get("repo"));
  if (!target) return NextResponse.json({ error: "A valid repo is required" }, { status: 400 });

  try {
    const file = await getRepoFile(user!.id, user!.email, target.owner, target.repo, CONFIG_PATH);
    if (!file) {
      return NextResponse.json(
        { error: `${CONFIG_PATH} was not found in this repo` },
        { status: 404 }
      );
    }
    return NextResponse.json({ repo: `${target.owner}/${target.repo}`, config: JSON.parse(file.content) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Could not read the bot config" }, { status: 400 });
  }
}

/**
 * Saves an edited catalogue back to the repo. The commit is what makes Vercel
 * redeploy the bot, so the change goes live without the user running git.
 */
export async function PUT(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;
  if (!canUseBotBuilder(user?.email)) return notEnabled();
  if (!(await isGitHubConnected(user!.id, user!.email))) {
    return NextResponse.json({ error: "GitHub account is not connected", connectRequired: true }, { status: 400 });
  }

  try {
    const body = await req.json();
    const target = splitRepo(body.repo);
    if (!target) return NextResponse.json({ error: "A valid repo is required" }, { status: 400 });

    const parsed = parseBotConfig(body.config);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const config: BotConfig = parsed.config;

    const { commit } = await putRepoFile(
      user!.id,
      user!.email,
      target.owner,
      target.repo,
      CONFIG_PATH,
      serializeBotConfig(config),
      `Update shop settings from CodingStudio (${config.products.length} product${config.products.length === 1 ? "" : "s"})`
    );

    await logActivity({
      userId: user!.id,
      workspaceId: null,
      type: "bot_builder",
      action: "bot_config_updated",
      title: `Updated bot config → ${target.owner}/${target.repo}`,
      detail: JSON.stringify({ repo: `${target.owner}/${target.repo}`, commit, products: config.products.length }),
      status: "success",
    });

    return NextResponse.json({ ok: true, commit });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Could not save the bot config" }, { status: 400 });
  }
}
