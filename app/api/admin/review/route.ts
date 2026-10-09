import { NextResponse } from "next/server";
import { getAuthenticatedUser, supabaseAdmin } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";
import { logActivity } from "@/lib/activities";
import { sanitizeError } from "@/lib/claude";

export const dynamic = "force-dynamic";

/**
 * Approve / reject a pending payment. Approve sets `user_plans.expires_at`
 * (+30 days from now); reject only marks the submission. Both are logged.
 */
export async function POST(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  let id = "";
  let action = "";
  try {
    const body = await req.json();
    id = String(body.id || "");
    action = String(body.action || "");
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^approve|reject$/.test(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const { data: row, error: getErr } = await supabaseAdmin
      .from("payment_submissions")
      .select("id, user_id, plan_id, status")
      .eq("id", id)
      .maybeSingle();
    if (getErr) throw getErr;
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (row.status !== "pending") {
      return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
    }

    const newStatus = action === "approve" ? "approved" : "rejected";
    const { error: upErr } = await supabaseAdmin
      .from("payment_submissions")
      .update({ status: newStatus })
      .eq("id", id);
    if (upErr) throw upErr;

    if (action === "approve") {
      const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
      const { error: planErr } = await supabaseAdmin
        .from("user_plans")
        .upsert(
          { user_id: row.user_id, plan_id: row.plan_id, expires_at: expires, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      if (planErr) throw planErr;
    }

    await logActivity({
      userId: user!.id,
      workspaceId: null,
      type: "admin",
      action: `payment_${action}`,
      title: `${action === "approve" ? "Approved" : "Rejected"} payment ${id}`,
      detail: `plan ${row.plan_id}, user ${row.user_id}`,
      status: "info",
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}
