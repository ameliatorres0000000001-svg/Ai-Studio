import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { readFileTree, readFileContent } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  const filePath = searchParams.get("path");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId is required" },
      { status: 400 }
    );
  }

  const { data: ws, error } = await supabaseAdmin
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error || !ws) {
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: 404 }
    );
  }

  try {
    if (filePath) {
      const content = readFileContent(ws.local_path, filePath);
      return NextResponse.json({ path: filePath, content });
    }

    const tree = readFileTree(ws.local_path);
    return NextResponse.json({ tree });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
