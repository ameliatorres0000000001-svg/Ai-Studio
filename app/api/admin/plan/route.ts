import { NextResponse } from "next/server";
import { getAuthenticatedUser, supabaseAdmin } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";
import { logActivity } from "@/lib/activities";
import { sanitizeError } from "@/lib/claude";

export const dynamic = "force-dynamic";

/** Admin: set a user's plan + expiry directly. Logged to activities. */
export async function POST(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  let userId = "";
  let planId = "";
  let expiresAt: string | null = null;
  try {
    const body = await req.json();
    userId = String(body.userId || "");
    planId = String(body.planId || "");
    expiresAt = body.expiresAt ? String(body.expiresAt) : null;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[a-z0-9_-]{1,32}$/i.test(planId)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (expiresAt && Number.isNaN(Date.parse(expiresAt))) {
    return NextResponse.json({ error: "Invalid expiry" }, { status: 400 });
  }

  try {
    const { data: plan } = await supabaseAdmin.from("plans").select("id").eq("id", planId).maybeSingle();
    if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });

    const { error: upErr } = await supabaseAdmin
      .from("user_plans")
      .upsert(
        { user_id: userId, plan_id: planId, expires_at: expiresAt, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    if (upErr) throw upErr;

    await logActivity({
      userId: user!.id,
      workspaceId: null,
      type: "admin",
      action: "set_plan",
      title: `Set plan "${planId}" for ${userId}`,
      detail: expiresAt ? `expires ${expiresAt}` : "no expiry",
      status: "info",
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}
