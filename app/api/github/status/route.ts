import { NextResponse } from "next/server";
import { getAuthenticatedUser as getAppUser, supabaseAdmin } from "@/lib/supabase-server";
import { getAuthenticatedUser as getGitHubUser, isGitHubConnected, isGitHubOAuthConfigured } from "@/lib/github";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { user, error: authError } = await getAppUser(req);
  if (authError) return authError;

  const { data: conn } = await supabaseAdmin
    .from("github_connections")
    .select("github_login, avatar_url")
    .eq("user_id", user!.id)
    .maybeSingle();

  const connected = conn ? true : await isGitHubConnected(user!.id, user!.email);
  if (!connected) {
    return NextResponse.json({
      configured: false,
      connectRequired: true,
      oauthConfigured: isGitHubOAuthConfigured(),
      adminFallback: isAdminEmail(user!.email) && !!process.env.GITHUB_ACCESS_TOKEN,
    });
  }

  // Resolve the login from the stored row, falling back to a live call.
  if (conn?.github_login) {
    return NextResponse.json({ configured: true, username: conn.github_login, avatar_url: conn.avatar_url });
  }
  try {
    const ghUser = await getGitHubUser(user!.id, user!.email);
    return NextResponse.json({ configured: true, username: ghUser.login, avatar_url: ghUser.avatar_url });
  } catch (error: any) {
    return NextResponse.json({ configured: false, error: error.message, connectRequired: true }, { status: 400 });
  }
}
