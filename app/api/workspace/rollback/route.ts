import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { rollbackToTag } from "@/lib/workspace";
import { logActivity } from "@/lib/activities";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { workspaceId, tag } = await req.json();

    if (!workspaceId || !tag) {
      return NextResponse.json(
        { error: "workspaceId and tag are required" },
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

    await rollbackToTag(ws.local_path, tag);
    await logActivity(
      workspaceId,
      "rollback",
      `Rolled back to ${tag}`,
      null,
      "warning"
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
