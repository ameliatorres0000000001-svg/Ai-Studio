import { NextResponse } from "next/server";
import { getAuthenticatedUser, supabaseAdmin } from "@/lib/supabase-server";
import { canUseBotBuilder } from "@/lib/bot-builder/access";

export const dynamic = "force-dynamic";

const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;

/**
 * Recovers "owner/repo" from a logged bot generation. Newer rows carry it as
 * JSON in `detail`; older rows only have the human-readable title, so fall
 * back to the arrow-separated suffix.
 */
function repoFromActivity(row: { title?: string | null; detail?: string | null }): string | null {
  if (row.detail) {
    try {
      const parsed = JSON.parse(row.detail);
      if (typeof parsed?.repo === "string" && REPO_RE.test(parsed.repo)) return parsed.repo;
    } catch {
      /* legacy plain-text detail */
    }
  }
  const m = (row.title || "").match(/→\s*([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\s*$/);
  return m ? m[1] : null;
}

/** The bots this user has generated, newest first, for the projects panel. */
export async function GET(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;
  if (!canUseBotBuilder(user?.email)) {
    return NextResponse.json({ error: "Bot Builder is not enabled for this account" }, { status: 403 });
  }

  const { data, error: dbError } = await supabaseAdmin
    .from("activities")
    .select("id, title, detail, created_at")
    .eq("user_id", user!.id)
    .eq("type", "bot_builder")
    .order("created_at", { ascending: false })
    .limit(100);

  if (dbError) {
    return NextResponse.json({ error: "Could not load projects" }, { status: 500 });
  }

  const seen = new Set<string>();
  const projects: { repo: string; title: string; createdAt: string }[] = [];
  for (const row of data || []) {
    const repo = repoFromActivity(row as any);
    if (!repo || seen.has(repo)) continue;
    seen.add(repo);
    projects.push({
      repo,
      title: (row as any).title || repo,
      createdAt: (row as any).created_at,
    });
  }

  return NextResponse.json({ projects });
}
