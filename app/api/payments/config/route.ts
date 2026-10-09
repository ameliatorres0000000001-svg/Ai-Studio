import { NextResponse } from "next/server";
import { getAuthenticatedUser, supabaseAdmin } from "@/lib/supabase-server";
import { listAvailableModels } from "@/lib/ai";

export const dynamic = "force-dynamic";

/**
 * Public checkout inputs: plan catalog, KHQR image URL, feature flag, and the
 * models each plan would unlock (ids/icons only). No secrets, no env values.
 */
export async function GET(req: Request) {
  const { error } = await getAuthenticatedUser(req);
  if (error) return error;

  const enabled = (process.env.FEATURE_PAYMENTS || "").toLowerCase() === "true";
  const khqrImageUrl = (process.env.PAYMENTS_KHQR_IMAGE_URL || "").trim() || null;

  let plans: { id: string; label: string; daily_limit: number; tiers: string[]; price_usd: number }[] = [];
  try {
    const { data } = await supabaseAdmin.from("plans").select("id, label, daily_limit, tiers, price_usd");
    if (data) plans = data as typeof plans;
  } catch {
    /* migration not applied yet — return an empty catalog */
  }
  plans.sort((a, b) => a.price_usd - b.price_usd);

  const maxPrice = Math.max(0, ...plans.map((p) => Number(p.price_usd) || 0));
  const models = listAvailableModels().map((m) => ({
    id: m.id,
    label: m.label,
    tier: m.tier,
    icon: m.icon,
  }));

  return NextResponse.json({
    enabled,
    khqrImageUrl,
    models,
    plans: plans.map((p) => {
      const price = Number(p.price_usd) || 0;
      return {
        id: p.id,
        label: p.label,
        priceUsd: price,
        dailyLimit: p.daily_limit,
        tiers: p.tiers,
        savePct: price > 0 && maxPrice > 0 ? Math.round((1 - price / maxPrice) * 100) : 0,
      };
    }),
  });
}
