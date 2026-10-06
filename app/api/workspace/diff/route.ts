import { NextResponse } from "next/server";
import { getAuthenticatedUser, getOwnedWorkspace } from "@/lib/supabase-server";
import { getGitDiff } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId is required" },
      { status: 400 }
    );
  }

  const { workspace, error: wsError } = await getOwnedWorkspace(workspaceId, user!.id);
  if (wsError) return wsError;

  try {
    const { diff, changedFiles } = await getGitDiff(workspace.local_path);
    return NextResponse.json({ diff, changedFiles });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
