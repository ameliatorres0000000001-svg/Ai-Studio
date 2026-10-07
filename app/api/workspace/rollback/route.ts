import { NextResponse } from "next/server";
import { getAuthenticatedUser, getOwnedWorkspace } from "@/lib/supabase-server";
import { rollbackToTag } from "@/lib/workspace";
import { logActivity } from "@/lib/activities";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;
  const userId = user!.id;

  try {
    const { workspaceId, tag } = await req.json();

    if (!workspaceId || !tag) {
      return NextResponse.json(
        { error: "workspaceId and tag are required" },
        { status: 400 }
      );
    }

    const { workspace, error: wsError } = await getOwnedWorkspace(workspaceId, userId);
    if (wsError) return wsError;

    await rollbackToTag(workspace.local_path, tag);
    await logActivity({
      userId,
      workspaceId,
      type: "rollback",
      action: "git_rollback",
      title: `Rolled back to ${tag}`,
      status: "warning",
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
