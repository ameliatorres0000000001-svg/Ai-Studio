import { NextResponse } from "next/server";
import { getAuthenticatedUser, supabaseAdmin } from "@/lib/supabase-server";
import { getUserPlan } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** This user's usage: today's totals plus the last 7 days. Counts only, never prompts. */
export async function GET(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;
  const userId = user!.id;

  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  let rows: { input_tokens: number; output_tokens: number; created_at: string }[] = [];
  try {
    const { data } = await supabaseAdmin
      .from("usage_events")
      .select("input_tokens, output_tokens, created_at")
      .eq("user_id", userId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true });
    rows = (data as typeof rows) ?? [];
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Usage unavailable" }, { status: 500 });
  }

  const days: { date: string; requests: number; inputTokens: number; outputTokens: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push({ date: dayKey(d), requests: 0, inputTokens: 0, outputTokens: 0 });
  }
  const byDay = new Map(days.map((d) => [d.date, d]));
  for (const r of rows) {
    const slot = byDay.get(dayKey(new Date(r.created_at)));
    if (!slot) continue;
    slot.requests += 1;
    slot.inputTokens += r.input_tokens || 0;
    slot.outputTokens += r.output_tokens || 0;
  }

  const today = days[days.length - 1];
  const plan = await getUserPlan(userId);

  return NextResponse.json({
    plan: plan.id,
    dailyLimit: plan.dailyLimit,
    today: { requests: today.requests, inputTokens: today.inputTokens, outputTokens: today.outputTokens },
    days,
  });
}
