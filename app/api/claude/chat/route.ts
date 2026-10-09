import { NextResponse } from "next/server";
import { getAuthenticatedUser, getOwnedWorkspace, supabaseAdmin } from "@/lib/supabase-server";
import { sendToClaude, applyChanges, sanitizeError } from "@/lib/claude";
import { EFFORTS, isPurpose, resolveModel } from "@/lib/ai";
import type { Effort, ProviderResult, Usage } from "@/lib/ai";
import { parseAttachments, sendResearch } from "@/lib/ai/research";
import { logActivity } from "@/lib/activities";
import { logUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;
  const userId = user!.id;

  try {
    const {
      workspaceId,
      message,
      currentFile,
      fileContent,
      apply,
      modelId,
      purpose,
      effort: rawEffort,
      attachments: rawAttachments,
    } = await req.json();

    if (!workspaceId || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "workspaceId and message are required" },
        { status: 400 }
      );
    }

    // Server-side allowlist: the browser only ever sends ids, never routes or keys.
    if (!isPurpose(purpose)) {
      return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
    }
    const model = resolveModel(modelId);
    if (!model) {
      return NextResponse.json(
        { error: "Unknown or unavailable model", setupRequired: true },
        { status: 400 }
      );
    }
    if (model.config.purpose !== purpose) {
      return NextResponse.json(
        { error: "This model is not allowed for the selected mode" },
        { status: 400 }
      );
    }
    let effort: Effort | undefined;
    if (rawEffort !== undefined && rawEffort !== null) {
      if (!EFFORTS.includes(rawEffort)) {
        return NextResponse.json({ error: "Invalid effort" }, { status: 400 });
      }
      effort = rawEffort;
    }
    let attachments: ReturnType<typeof parseAttachments> = [];
    if (purpose === "research") {
      try {
        attachments = parseAttachments(rawAttachments);
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
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
      action: purpose === "research" ? "research_prompt" : "claude_prompt",
      title: `Asked ${purpose === "research" ? "Research" : "Claude"}: ${message.substring(0, 100)}`,
      prompt: message,
      status: "info",
    });

    let text: string;
    let usage: Usage;
    let proposed: { path: string; content: string }[] = [];
    let diff: string | null = null;

    try {
      if (purpose === "research") {
        // Research mode: no workspace path, no repo contents, no file blocks.
        const result: ProviderResult = await sendResearch(model, effort, message, attachments);
        text = result.text;
        usage = result.usage;
      } else {
        const result = await sendToClaude(model, effort, workspace.local_path, message, {
          currentFile,
          fileContent,
        });
        text = result.text;
        usage = result.usage;
        proposed = result.filesChanged;
        diff = result.diff;
      }
    } catch (modelError: any) {
      const errMessage = sanitizeError(modelError);
      await supabaseAdmin
        .from("claude_sessions")
        .update({ status: "error", completed_at: new Date().toISOString() })
        .eq("id", session!.id);
      await logActivity({
        userId,
        workspaceId,
        type: "claude",
        action: "claude_error",
        title: `Model error: ${errMessage}`,
        prompt: message,
        error: errMessage,
        status: "error",
      });
      return NextResponse.json({ error: errMessage }, { status: 500 });
    }

    await logUsage({ userId, workspaceId, model, purpose, effort, usage });

    let applied = false;
    if (purpose === "code" && apply && proposed.length > 0) {
      applyChanges(workspace.local_path, proposed);
      applied = true;
      await logActivity({
        userId,
        workspaceId,
        type: "claude",
        action: "claude_edit",
        title: `Claude edited ${proposed.length} file(s)`,
        detail: proposed.map((f) => f.path).join(", "),
        filesChanged: proposed.map((f) => f.path),
        status: "success",
      });
    }

    const cleanText =
      purpose === "code"
        ? text.replace(/<<<FILE:.+?>>>\n[\s\S]*?\n<<<ENDFILE>>>/g, "[File changes applied]")
        : text;

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
        files_changed: proposed.map((f) => f.path),
        completed_at: new Date().toISOString(),
      })
      .eq("id", session!.id);

    return NextResponse.json({
      response: cleanText,
      filesChanged: proposed.map((f) => f.path),
      proposedFiles: proposed,
      diff,
      applied,
    });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
