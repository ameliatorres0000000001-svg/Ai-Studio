import modelsJson from "@/config/models.json";
import type { ModelsConfig, Tier } from "./ai/types";

// SERVER-ONLY (except evaluateEntitlement, which is pure and unit-tested by
// scripts/test-quota.mjs). Decides whether a user may call a model: plan tier,
// daily request limit, and plan expiry are all enforced here, on the server.

const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, premium: 2 };

const FREE_FALLBACK = { id: "free", dailyLimit: 5, tiers: ["free"] as Tier[] };

export interface PlanInfo {
  id: string;
  dailyLimit: number;
  tiers: Tier[];
  expired: boolean;
}

export interface EntitlementDeps {
  getPlan(userId: string): Promise<PlanInfo>;
  countToday(userId: string): Promise<number>;
}

export interface EntitlementResult {
  allowed: boolean;
  reason?: "quota" | "tier" | "unknown_model";
  tier: Tier | null;
  dailyLimit: number;
  usedToday: number;
  plan: string;
  messageKh: string;
  messageEn: string;
}

function modelTier(modelId: string): Tier | null {
  const config = modelsJson as unknown as ModelsConfig;
  return config.models.find((m) => m.id === modelId)?.tier ?? null;
}

function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

/** Pure decision function: no I/O, safe to test with mocked inputs. */
export function evaluateEntitlement(input: {
  plan: PlanInfo;
  usedToday: number;
  tier: Tier | null;
  isAdmin: boolean;
}): EntitlementResult {
  const { plan, usedToday, tier, isAdmin } = input;

  if (isAdmin) {
    return {
      allowed: true,
      tier,
      dailyLimit: -1,
      usedToday,
      plan: plan.id,
      messageKh: "",
      messageEn: "",
    };
  }

  if (!tier) {
    return {
      allowed: false,
      reason: "unknown_model",
      tier,
      dailyLimit: plan.dailyLimit,
      usedToday,
      plan: plan.id,
      messageKh: "ម៉ូដែលនេះមិនស្គាល់ទេ។",
      messageEn: "Unknown model.",
    };
  }

  if (!plan.tiers.includes(tier)) {
    return {
      allowed: false,
      reason: "tier",
      tier,
      dailyLimit: plan.dailyLimit,
      usedToday,
      plan: plan.id,
      messageKh: `សូមអភ័យទោស! ម៉ូដែលនេះសម្រាប់តែគម្រោង ${tier.toUpperCase()} ប៉ុណ្ណោះ។ សូម Upgrade គម្រោងរបស់អ្នកដើម្បីប្រើវា។`,
      messageEn: `Sorry! This model is for ${tier.toUpperCase()} plans only. Please upgrade your plan to use it.`,
    };
  }

  if (usedToday >= plan.dailyLimit) {
    return {
      allowed: false,
      reason: "quota",
      tier,
      dailyLimit: plan.dailyLimit,
      usedToday,
      plan: plan.id,
      messageKh: "សូមអភ័យទោស! អ្នកបានប្រើអស់កម្រិតថ្ងៃនេះហើយ។ សូមរង់ចាំថ្ងៃស្អែក ឬ Upgrade ដើម្បីបន្ត។",
      messageEn: "Sorry! You've reached today's limit. Please wait until tomorrow or upgrade to continue.",
    };
  }

  return {
    allowed: true,
    tier,
    dailyLimit: plan.dailyLimit,
    usedToday,
    plan: plan.id,
    messageKh: "",
    messageEn: "",
  };
}

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function liveDeps(): Promise<EntitlementDeps> {
  const { supabaseAdmin } = await import("./supabase-server");
  return {
    async getPlan(userId: string): Promise<PlanInfo> {
      try {
        const { data } = await supabaseAdmin
          .from("user_plans")
          .select("plan_id, expires_at, plans(id, daily_limit, tiers)")
          .eq("user_id", userId)
          .maybeSingle();
        const row: any = data;
        const p = Array.isArray(row?.plans) ? row.plans[0] : row?.plans;
        if (!row || !p) return { ...FREE_FALLBACK, expired: false };
        const expired = !!row.expires_at && new Date(row.expires_at).getTime() < Date.now();
        if (expired) return { ...FREE_FALLBACK, expired: true };
        return {
          id: String(p.id),
          dailyLimit: Number(p.daily_limit) || 0,
          tiers: (Array.isArray(p.tiers) ? p.tiers : ["free"]).filter((t: string) => t in TIER_RANK) as Tier[],
          expired: false,
        };
      } catch {
        return { ...FREE_FALLBACK, expired: false };
      }
    },
    async countToday(userId: string): Promise<number> {
      try {
        const { count } = await supabaseAdmin
          .from("usage_events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", startOfTodayISO());
        return count ?? 0;
      } catch {
        return 0;
      }
    },
  };
}

/** Server-side gate for model calls. ADMIN_EMAILS bypass all limits. */
export async function checkEntitlement(
  userId: string,
  modelId: string,
  userEmail?: string,
  deps?: EntitlementDeps
): Promise<EntitlementResult> {
  const d = deps ?? (await liveDeps());
  const [plan, usedToday] = await Promise.all([d.getPlan(userId), d.countToday(userId)]);
  return evaluateEntitlement({
    plan,
    usedToday,
    tier: modelTier(modelId),
    isAdmin: isAdminEmail(userEmail),
  });
}

/** The user's current plan for display (usage bar, dashboard). Never throws. */
export async function getUserPlan(userId: string): Promise<PlanInfo> {
  try {
    return await (await liveDeps()).getPlan(userId);
  } catch {
    return { ...FREE_FALLBACK, expired: false };
  }
}
