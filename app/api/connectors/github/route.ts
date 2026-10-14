import { NextResponse } from "next/server";
import { getAuthenticatedUser, supabaseAdmin } from "@/lib/supabase-server";
import { isGitHubConnected, isGitHubOAuthConfigured } from "@/lib/github";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** Returns connection metadata only — never token_enc. */
export async function GET(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const { data: conn } = await supabaseAdmin
    .from("github_connections")
    .select("github_login, avatar_url, scopes, created_at")
    .eq("user_id", user!.id)
    .maybeSingle();

  return NextResponse.json({
    connected: conn ? true : await isGitHubConnected(user!.id, user!.email),
    login: conn?.github_login ?? null,
    avatarUrl: conn?.avatar_url ?? null,
    scopes: conn?.scopes ?? null,
    oauthConfigured: isGitHubOAuthConfigured(),
    adminFallback: isAdminEmail(user!.email) && !!process.env.GITHUB_ACCESS_TOKEN,
  });
}

export async function DELETE(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;
  await supabaseAdmin.from("github_connections").delete().eq("user_id", user!.id);
  return NextResponse.json({ ok: true });
}
