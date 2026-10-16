import { NextResponse } from "next/server";
import { getAuthenticatedUser, supabaseAdmin } from "@/lib/supabase-server";
import { errorResponse } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

/** The signed-in user's payment submissions (no receipt paths or other users' rows). */
export async function GET(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;
  try {
    const { data, error: dbError } = await supabaseAdmin
      .from("payment_submissions")
      .select("id, plan_id, amount, method, status, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (dbError) throw new Error(dbError.message);
    return NextResponse.json({ payments: data || [] });
  } catch (e) {
    return errorResponse(e);
  }
}
