import { NextResponse } from "next/server";
import { getAuthenticatedUser, getOwnedWorkspace, supabaseAdmin } from "@/lib/supabase-server";
import { resolveModel } from "@/lib/ai";
import { checkEntitlement } from "@/lib/entitlements";
import { logUsage } from "@/lib/usage";
import { logActivity } from "@/lib/activities";
import { sanitizeError } from "@/lib/claude";
import { runAgent, AgentBusyError, type AgentEvent } from "@/lib/agent/run";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sseEncode(event: AgentEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;
  const userId = user!.id;

  try {
    const { workspaceId, message, mode, modelId, resumeSessionId } = await req.json();

    if (!workspaceId || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "workspaceId and message are required" }, { status: 400 });
    }
    const runMode = mode === "plan" ? "plan" : "code";

    const model = resolveModel(modelId);
    if (!model) {
      return NextResponse.json({ error: "Unknown or unavailable model", setupRequired: true }, { status: 400 });
    }
    if (model.route.format !== "anthropic") {
      return NextResponse.json({ error: "Agent mode needs a Claude model" }, { status: 400 });
    }
    if (!model.config.purpose.includes("code")) {
      return NextResponse.json({ error: "This model is not allowed for code mode" }, { status: 400 });
    }

    const entitlement = await checkEntitlement(userId, model.config.id, user!.email);
    if (!entitlement.allowed) {
      return NextResponse.json(
        {
          error: entitlement.messageEn,
          messageKh: entitlement.messageKh,
          messageEn: entitlement.messageEn,
          quotaExceeded: entitlement.reason === "quota",
          tierLocked: entitlement.reason === "tier",
        },
        { status: 429 }
      );
    }

    const { workspace, error: wsError } = await getOwnedWorkspace(workspaceId, userId);
    if (wsError || !workspace) return wsError ?? NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const { data: session } = await supabaseAdmin
      .from("claude_sessions")
      .insert({ user_id: userId, workspace_id: workspaceId, status: "active", prompt: message })
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
      action: runMode === "plan" ? "plan_prompt" : "claude_prompt",
      title: `${runMode === "plan" ? "Plan" : "Asked"}: ${message.substring(0, 100)}`,
      prompt: message,
      status: "info",
    });

    const resumeId = typeof resumeSessionId === "string" && resumeSessionId ? resumeSessionId : undefined;

    const encoder = new TextEncoder();
    const streamBody = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: AgentEvent) => {
          try {
            controller.enqueue(encoder.encode(sseEncode(event)));
          } catch {
            /* client disconnected */
          }
        };

        let finalText = "";
        let sdkSessionId: string | undefined;
        let usageTotals = { inputTokens: 0, outputTokens: 0 };
        let isError = false;

        try {
          await runAgent({
            userId,
            workspace,
            model,
            mode: runMode,
            prompt: message,
            resumeSessionId: resumeId,
            signal: req.signal,
            onEvent: (event) => {
              send(event);
              if (event.type === "text_delta") finalText += event.text;
              if (event.type === "session") sdkSessionId = event.sessionId;
              if (event.type === "usage") usageTotals = { inputTokens: event.inputTokens, outputTokens: event.outputTokens };
              if (event.type === "done") isError = event.isError;
              if (event.type === "error") isError = true;
            },
          });
        } catch (e: any) {
          isError = true;
          if (e instanceof AgentBusyError) {
            send({ type: "error", message: "Agent is already running" });
          } else {
            send({ type: "error", message: sanitizeError(e) });
          }
        }

        // Persist the run.
        try {
          await supabaseAdmin
            .from("claude_sessions")
            .update({
              status: isError ? "error" : "completed",
              result_summary: finalText.substring(0, 500),
              sdk_session_id: sdkSessionId ?? null,
              completed_at: new Date().toISOString(),
            })
            .eq("id", session!.id);

          if (finalText.trim()) {
            await supabaseAdmin.from("chat_messages").insert({
              user_id: userId,
              workspace_id: workspaceId,
              role: "assistant",
              content: finalText,
            });
          }

          if (!isError && (usageTotals.inputTokens || usageTotals.outputTokens)) {
            await logUsage({ userId, workspaceId, model, purpose: "code", usage: usageTotals });
          }

          await logActivity({
            userId,
            workspaceId,
            type: "claude",
            action: isError ? "claude_error" : "claude_edit",
            title: isError ? "Agent run failed" : "Agent run completed",
            prompt: message,
            status: isError ? "error" : "success",
          });
        } catch {
          /* persistence best-effort */
        }

        try {
          controller.close();
        } catch {
          /* already closed */
        }
      },
    });

    return new Response(streamBody, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: any) {
    if (error instanceof AgentBusyError) {
      return NextResponse.json({ error: "Agent is already running" }, { status: 409 });
    }
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
