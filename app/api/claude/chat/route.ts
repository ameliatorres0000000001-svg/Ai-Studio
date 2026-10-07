import { NextResponse } from "next/server";
import { getAuthenticatedUser, getOwnedWorkspace, supabaseAdmin } from "@/lib/supabase-server";
import { sendToClaude, applyChanges, isClaudeConfigured } from "@/lib/claude";
import { logActivity } from "@/lib/activities";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;
  const userId = user!.id;

  if (!isClaudeConfigured()) {
    return NextResponse.json(
      {
        error: "Claude not configured — Add API key in Settings",
        setupRequired: true,
        envVars: ["ANTHROPIC_API_KEY"],
      },
      { status: 400 }
    );
  }

  try {
    const { workspaceId, message, currentFile, fileContent, apply } =
      await req.json();

    if (!workspaceId || !message) {
      return NextResponse.json(
        { error: "workspaceId and message are required" },
        { status: 400 }
      );
    }

    const { workspace, error: wsError } = await getOwnedWorkspace(workspaceId, userId);
    if (wsError || !workspace) {
  return (
    wsError ??
    NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  );
}

    const { data: session } = await supabaseAdmin
      .from("claude_sessions")
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        status: "active",
        prompt: message,
      })
      .select()
      .single();

    await supabaseAdmin.from("chat_messages").insert({
      user_id: userId,
      workspace_id: workspaceId,
      role: "user",
      content: message,
    });

    await logActivity({
      userId,
      workspaceId,
      type: "claude",
      action: "claude_prompt",
      title: `Asked Claude: ${message.substring(0, 100)}`,
      prompt: message,
      status: "info",
    });

    let result;
    try {
      result = await sendToClaude(workspace.local_path, message, {
        currentFile,
        fileContent,
      });
    } catch (claudeError: any) {
      await supabaseAdmin
        .from("claude_sessions")
        .update({ status: "error", completed_at: new Date().toISOString() })
        .eq("id", session!.id);
      await logActivity({
        userId,
        workspaceId,
        type: "claude",
        action: "claude_error",
        title: `Claude error: ${claudeError.message}`,
        prompt: message,
        error: claudeError.message,
        status: "error",
      });
      return NextResponse.json({ error: claudeError.message }, { status: 500 });
    }

    let applied = false;
    if (apply && result.filesChanged.length > 0) {
      applyChanges(workspace.local_path, result.filesChanged);
      applied = true;
      await logActivity({
        userId,
        workspaceId,
        type: "claude",
        action: "claude_edit",
        title: `Claude edited ${result.filesChanged.length} file(s)`,
        detail: result.filesChanged.map((f) => f.path).join(", "),
        filesChanged: result.filesChanged.map((f) => f.path),
        status: "success",
      });
    }

    const cleanText = result.text.replace(
      /<<<FILE:.+?>>>\n[\s\S]*?\n<<<ENDFILE>>>/g,
      "[File changes applied]"
    );

    await supabaseAdmin.from("chat_messages").insert({
      user_id: userId,
      workspace_id: workspaceId,
      role: "assistant",
      content: cleanText,
    });

    await supabaseAdmin
      .from("claude_sessions")
      .update({
        status: "completed",
        result_summary: cleanText.substring(0, 500),
        files_changed: result.filesChanged.map((f) => f.path),
        completed_at: new Date().toISOString(),
      })
      .eq("id", session!.id);

    return NextResponse.json({
      response: cleanText,
      filesChanged: result.filesChanged.map((f) => f.path),
      diff: result.diff,
      applied,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
