import { NextResponse } from "next/server";
import { getAuthenticatedUser, getOwnedWorkspace } from "@/lib/supabase-server";
import { readFileTree, readFileContent } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  const filePath = searchParams.get("path");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId is required" },
      { status: 400 }
    );
  }

  const { workspace, error: wsError } = await getOwnedWorkspace(workspaceId, user!.id);
  if (wsError) return wsError;

  const workspaceRoot = process.env.WORKSPACE_ROOT?.trim();
  const workspacePath = workspace.local_path?.trim();
  if (!workspaceRoot || !workspacePath) {
    return NextResponse.json(
      { error: "Workspace path is empty" },
      { status: 400 }
    );
  }

  try {
    if (filePath) {
      const content = readFileContent(workspacePath, filePath);
      return NextResponse.json({ path: filePath, content });
    }

    const tree = readFileTree(workspacePath);
    return NextResponse.json({ tree });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
