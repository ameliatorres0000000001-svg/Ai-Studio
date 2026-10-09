import { NextResponse } from "next/server";
import { getAuthenticatedUser, supabaseAdmin } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";
import { sanitizeError } from "@/lib/claude";

export const dynamic = "force-dynamic";

/** Admin: one user's plan, expiry, ban state and per-model usage (7 days). */
export async function GET(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const userId = new URL(req.url).searchParams.get("userId") || "";
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    const { data: planRow } = await supabaseAdmin
      .from("user_plans")
      .select("plan_id, expires_at, plans(id)")
      .eq("user_id", userId)
      .maybeSingle();

    let disabled = false;
    try {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
      disabled = !!u?.user?.banned_until;
    } catch {
      /* best effort */
    }

    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    const { data: events } = await supabaseAdmin
      .from("usage_events")
      .select("model_id, input_tokens, output_tokens, created_at")
      .eq("user_id", userId)
      .gte("created_at", since.toISOString());

    const byModel = new Map<string, { modelId: string; requests: number; inputTokens: number; outputTokens: number }>();
    let today = 0;
    const todayKey = new Date().toISOString().slice(0, 10);
    for (const e of events || []) {
      const slot = byModel.get(e.model_id) || { modelId: e.model_id, requests: 0, inputTokens: 0, outputTokens: 0 };
      slot.requests += 1;
      slot.inputTokens += e.input_tokens || 0;
      slot.outputTokens += e.output_tokens || 0;
      byModel.set(e.model_id, slot);
      if (String(e.created_at).slice(0, 10) === todayKey) today += 1;
    }

    const plan = (planRow as any)?.plan_id ?? "free";
    const expiresAt = (planRow as any)?.expires_at ?? null;
    const expired = !!expiresAt && new Date(expiresAt).getTime() < Date.now();

    return NextResponse.json({
      plan: expired ? "free" : plan,
      expiresAt,
      expired,
      disabled,
      today,
      byModel: Array.from(byModel.values()).sort((a, b) => b.requests - a.requests),
    });
  } catch (e: any) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}
