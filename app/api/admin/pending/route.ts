import { NextResponse } from "next/server";
import { getAuthenticatedUser, supabaseAdmin } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";
import { sanitizeError } from "@/lib/claude";

export const dynamic = "force-dynamic";

const BUCKET = "receipts";
const SIGNED_TTL = 300; // seconds — previews expire fast.

/** Admin-only queue of pending manual payments, with short-lived receipt URLs. */
export async function GET(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const { data, error: qErr } = await supabaseAdmin
      .from("payment_submissions")
      .select("id, user_id, plan_id, amount, trx_id, receipt_path, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (qErr) throw qErr;

    const items = await Promise.all(
      (data || []).map(async (row: any) => {
        let receiptUrl: string | null = null;
        if (row.receipt_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUrl(row.receipt_path, SIGNED_TTL);
          receiptUrl = signed?.signedUrl ?? null;
        }
        // user_emails may be missing (migration optional); never fail the row.
        let userEmail: string | null = null;
        try {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
          userEmail = u?.user?.email ?? null;
        } catch {
          /* best effort */
        }
        return {
          id: row.id,
          userId: row.user_id,
          userEmail,
          planId: row.plan_id,
          amount: Number(row.amount) || 0,
          trxId: row.trx_id,
          receiptUrl,
          createdAt: row.created_at,
        };
      })
    );

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}
