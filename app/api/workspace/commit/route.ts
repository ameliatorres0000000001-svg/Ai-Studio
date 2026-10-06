import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { commitAndPush, createBackup } from "@/lib/workspace";
import { logActivity } from "@/lib/activities";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { workspaceId, message } = await req.json();

    if (!workspaceId || !message) {
      return NextResponse.json(
        { error: "workspaceId and message are required" },
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

    const backupTag = await createBackup(ws.local_path, "precommit");
    await commitAndPush(ws.local_path, message);

    await logActivity(
      workspaceId,
      "commit",
      `Committed and pushed: ${message}`,
      `Backup tag: ${backupTag}`,
      "success"
    );

    return NextResponse.json({ success: true, backupTag });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
