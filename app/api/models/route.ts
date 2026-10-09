import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { listAvailableModels } from "@/lib/ai";
import { getUserPlan } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

/** Models whose route env vars are set on the server. Ids and labels only: no routes, keys or env names. */
export async function GET(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const plan = await getUserPlan(user!.id);
  return NextResponse.json({ models: listAvailableModels(), plan: plan.id });
}
