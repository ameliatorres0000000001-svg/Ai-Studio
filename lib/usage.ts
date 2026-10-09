import { supabaseAdmin } from "./supabase-server";
import type { Effort, Purpose, ResolvedModel, Usage } from "./ai";

// SERVER-ONLY. Best-effort cost tracking: a failed insert never fails the user's request.

export async function logUsage(p: {
  userId: string;
  workspaceId: string | null;
  model: ResolvedModel;
  purpose: Purpose;
  effort?: Effort;
  usage: Usage;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("usage_events").insert({
      user_id: p.userId,
      workspace_id: p.workspaceId,
      model_id: p.model.config.id,
      upstream_model: p.model.config.upstreamModel,
      route: p.model.routeName,
      purpose: p.purpose,
      effort: p.effort ?? null,
      input_tokens: p.usage.inputTokens,
      output_tokens: p.usage.outputTokens,
    });
    if (error) console.error("usage_events insert failed:", error.message);
  } catch (e) {
    console.error("usage_events insert failed:", e instanceof Error ? e.message : "unknown error");
  }
}
