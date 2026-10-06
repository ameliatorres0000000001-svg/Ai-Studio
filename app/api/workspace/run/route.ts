import { NextResponse } from "next/server";
import { getAuthenticatedUser, getOwnedWorkspace } from "@/lib/supabase-server";
import { validateCommand, runCommand } from "@/lib/workspace";
import { logActivity } from "@/lib/activities";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;
  const userId = user!.id;

  try {
    const { workspaceId, command } = await req.json();

    if (!workspaceId || !command) {
      return NextResponse.json(
        { error: "workspaceId and command are required" },
        { status: 400 }
      );
    }

    const { workspace, error: wsError } = await getOwnedWorkspace(workspaceId, userId);
    if (wsError) return wsError;

    const validation = validateCommand(command);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Command rejected: ${validation.reason}` },
        { status: 403 }
      );
    }

    await logActivity({
      userId,
      workspaceId,
      type: "run",
      action: "command_run",
      title: `Running: ${command}`,
      command,
      status: "info",
    });

    const result = await runCommand(workspace.local_path, command);

    const isTest = command.includes("test") || command.includes("jest") || command.includes("vitest");
    await logActivity({
      userId,
      workspaceId,
      type: "run",
      action: "command_completed",
      title: `Command completed: ${command}`,
      detail: `Exit code: ${result.exitCode}${result.timedOut ? " (timed out)" : ""}`,
      command,
      testResult: isTest ? result.stdout.substring(0, 2000) : null,
      error: result.exitCode !== 0 && result.stderr ? result.stderr.substring(0, 500) : null,
      status: result.exitCode === 0 ? "success" : "error",
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
