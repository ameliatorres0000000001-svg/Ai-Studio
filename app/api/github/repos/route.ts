import { NextResponse } from "next/server";
import { listRepositories, isGitHubConnected, GitHubNotConnectedError } from "@/lib/github";
import { getAuthenticatedUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  if (!(await isGitHubConnected(user!.id, user!.email))) {
    return NextResponse.json({ error: "GitHub account is not connected", connectRequired: true }, { status: 400 });
  }

  try {
    const repos = await listRepositories(user!.id, user!.email);
    return NextResponse.json({ repos });
  } catch (error: any) {
    if (error instanceof GitHubNotConnectedError) {
      return NextResponse.json({ error: error.message, connectRequired: true }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
