import { NextResponse } from "next/server";
import { isGitHubConfigured, getAuthenticatedUser } from "@/lib/github";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isGitHubConfigured()) {
    return NextResponse.json({
      configured: false,
      setupRequired: true,
      envVars: ["GITHUB_ACCESS_TOKEN"],
      message:
        "GitHub is not connected. Create a Personal Access Token at https://github.com/settings/tokens with repo scope and set GITHUB_ACCESS_TOKEN in your .env file.",
    });
  }

  try {
    const user = await getAuthenticatedUser();

    const { data: existing } = await supabaseAdmin
      .from("github_connections")
      .select("*")
      .eq("username", user.login)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin.from("github_connections").insert({
        username: user.login,
        avatar_url: user.avatar_url,
        last_synced_at: new Date().toISOString(),
      });
    } else {
      await supabaseAdmin
        .from("github_connections")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("username", user.login);
    }

    return NextResponse.json({
      configured: true,
      username: user.login,
      avatar_url: user.avatar_url,
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
