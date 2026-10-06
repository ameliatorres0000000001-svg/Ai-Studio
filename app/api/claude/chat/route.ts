import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { sendToClaude, applyChanges, isClaudeConfigured } from "@/lib/claude";
import { logActivity } from "@/lib/activities";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isClaudeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Claude is not configured. Set ANTHROPIC_API_KEY in your .env file.",
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

    await supabaseAdmin.from("chat_messages").insert({
      workspace_id: workspaceId,
      role: "user",
      content: message,
    });

    await logActivity(
      workspaceId,
      "claude",
      `Asked Claude: ${message.substring(0, 100)}`,
      null,
      "info"
    );

    const result = await sendToClaude(ws.local_path, message, {
      currentFile,
      fileContent,
    });

    let applied = false;
    if (apply && result.filesChanged.length > 0) {
      applyChanges(ws.local_path, result.filesChanged);
      applied = true;
      await logActivity(
        workspaceId,
        "claude",
        `Claude edited ${result.filesChanged.length} file(s)`,
        result.filesChanged.map((f) => f.path).join(", "),
        "success"
      );
    }

    const cleanText = result.text.replace(
      /<<<FILE:.+?>>>\n[\s\S]*?\n<<<ENDFILE>>>/g,
      "[File changes applied]"
    );

    await supabaseAdmin.from("chat_messages").insert({
      workspace_id: workspaceId,
      role: "assistant",
      content: cleanText,
    });

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
