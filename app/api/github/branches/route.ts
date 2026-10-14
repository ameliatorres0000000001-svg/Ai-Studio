import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { listBranches, parseRepoFullName, isRepoAllowed } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const repo = parseRepoFullName(new URL(req.url).searchParams.get("repo"));
  if (!repo || !isRepoAllowed(`${repo.owner}/${repo.repo}`)) {
    return NextResponse.json({ error: "Invalid or disallowed repository" }, { status: 400 });
  }

  try {
    const branches = await listBranches(user!.id, user!.email, repo.owner, repo.repo);
    return NextResponse.json({ branches });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error?.connectRequired ? 400 : 500 });
  }
}
