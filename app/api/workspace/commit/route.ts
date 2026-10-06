import { NextResponse } from "next/server";
import { getAuthenticatedUser, getOwnedWorkspace } from "@/lib/supabase-server";
import { commitAndPush, createBackup } from "@/lib/workspace";
import { logActivity } from "@/lib/activities";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;
  const userId = user!.id;

  try {
    const { workspaceId, message } = await req.json();

    if (!workspaceId || !message) {
      return NextResponse.json(
        { error: "workspaceId and message are required" },
        { status: 400 }
      );
    }

    const { workspace, error: wsError } = await getOwnedWorkspace(workspaceId, userId);
    if (wsError) return wsError;

    const backupTag = await createBackup(workspace.local_path, "precommit");
    await commitAndPush(workspace.local_path, message);

    await logActivity({
      userId,
      workspaceId,
      type: "commit",
      action: "git_commit_push",
      title: `Committed and pushed: ${message}`,
      detail: `Backup tag: ${backupTag}`,
      status: "success",
    });

    return NextResponse.json({ success: true, backupTag });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
