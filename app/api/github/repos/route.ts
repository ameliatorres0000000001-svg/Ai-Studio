import { NextResponse } from "next/server";
import { listRepositories, isGitHubConfigured } from "@/lib/github";
import { getAuthenticatedUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  if (!isGitHubConfigured()) {
    return NextResponse.json(
      {
        error: "Not connected — Configure in Settings",
        setupRequired: true,
        envVars: ["GITHUB_ACCESS_TOKEN"],
      },
      { status: 400 }
    );
  }

  try {
    const repos = await listRepositories();
    return NextResponse.json({ repos });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
