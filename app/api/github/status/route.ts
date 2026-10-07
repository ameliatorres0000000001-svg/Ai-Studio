import { NextResponse } from "next/server";
import { isGitHubConfigured, getAuthenticatedUser as getGitHubUser } from "@/lib/github";
import { getAuthenticatedUser, supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  if (!isGitHubConfigured()) {
    return NextResponse.json({
      configured: false,
      setupRequired: true,
      envVars: ["GITHUB_ACCESS_TOKEN"],
      message: "Not connected — Configure in Settings",
    });
  }

  try {
    const ghUser = await getGitHubUser();

    const { data: existing } = await supabaseAdmin
      .from("github_connections")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin.from("github_connections").insert({
        user_id: user!.id,
        username: ghUser.login,
        avatar_url: ghUser.avatar_url,
        last_synced_at: new Date().toISOString(),
      });
    } else {
      await supabaseAdmin
        .from("github_connections")
        .update({
          username: ghUser.login,
          avatar_url: ghUser.avatar_url,
          last_synced_at: new Date().toISOString(),
        })
        .eq("user_id", user!.id);
    }

    return NextResponse.json({
      configured: true,
      username: ghUser.login,
      avatar_url: ghUser.avatar_url,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        configured: false,
        error: error.message,
        setupRequired: true,
        envVars: ["GITHUB_ACCESS_TOKEN"],
      },
      { status: 500 }
    );
  }
}
