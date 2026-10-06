import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { validateCommand, runCommand } from "@/lib/workspace";
import { logActivity } from "@/lib/activities";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { workspaceId, command } = await req.json();

    if (!workspaceId || !command) {
      return NextResponse.json(
        { error: "workspaceId and command are required" },
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

    const validation = validateCommand(command);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Command rejected: ${validation.reason}` },
        { status: 403 }
      );
    }

    await logActivity(workspaceId, "run", `Running: ${command}`, null, "info");

    const result = await runCommand(ws.local_path, command);

    await logActivity(
      workspaceId,
      "run",
      `Command completed: ${command}`,
      `Exit code: ${result.exitCode}${result.timedOut ? " (timed out)" : ""}`,
      result.exitCode === 0 ? "success" : "error"
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
