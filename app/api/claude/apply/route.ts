import { NextResponse } from "next/server";
import { getAuthenticatedUser, getOwnedWorkspace } from "@/lib/supabase-server";
import { applyChanges } from "@/lib/claude";
import { logActivity } from "@/lib/activities";
import { resolveLocalPath, errorResponse } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

const MAX_FILES = 50;

/** Writes user-approved file changes into the workspace (no Claude call). */
export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;
  const userId = user!.id;

  try {
    const { workspaceId, files } = await req.json();

    if (!workspaceId || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "workspaceId and files are required" }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Too many files (max ${MAX_FILES})` }, { status: 400 });
    }
    for (const f of files) {
      if (!f || typeof f.path !== "string" || typeof f.content !== "string") {
        return NextResponse.json({ error: "Each file needs string path and content" }, { status: 400 });
      }
    }

    const { workspace, error: wsError } = await getOwnedWorkspace(workspaceId, userId);
    if (wsError) return wsError;
    const { localPath, error: pathError } = resolveLocalPath(workspace!);
    if (pathError) return pathError;

    try {
      applyChanges(localPath, files);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    const paths = files.map((f: { path: string }) => f.path);
    await logActivity({
      userId,
      workspaceId,
      type: "claude",
      action: "claude_edit",
      title: `Applied changes to ${paths.length} file(s)`,
      detail: paths.join(", "),
      filesChanged: paths,
      status: "success",
    });

    return NextResponse.json({ applied: true, filesChanged: paths });
  } catch (e) {
    return errorResponse(e);
  }
}
