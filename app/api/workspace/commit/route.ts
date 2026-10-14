import { NextResponse } from "next/server";
import { getAuthenticatedUser, getOwnedWorkspace } from "@/lib/supabase-server";
import { commitAndPush, createBackup } from "@/lib/workspace";
import { logActivity } from "@/lib/activities";
import { getCloneUrl, isRepoAllowed, parseRepoFullName } from "@/lib/github";

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

    const repo = parseRepoFullName(workspace!.repo_full_name);
    if (!repo || !isRepoAllowed(workspace!.repo_full_name)) {
      return NextResponse.json({ error: "Repository is not allowed" }, { status: 403 });
    }

    const backupTag = await createBackup(workspace.local_path, "precommit");
    await commitAndPush(
      workspace.local_path,
      message,
      await getCloneUrl(userId, user!.email, repo.owner, repo.repo)
    );

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
