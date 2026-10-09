import { NextResponse } from "next/server";
import { getAuthenticatedUser, supabaseAdmin } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activities";
import { sanitizeError } from "@/lib/claude";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
]);
const BUCKET = "receipts";

/** Fixed window: at most 5 submissions per user per 10 minutes. */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const buckets = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (buckets.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    buckets.set(userId, recent);
    return true;
  }
  recent.push(now);
  buckets.set(userId, recent);
  return false;
}

async function ensureReceiptsBucket(): Promise<void> {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET, { public: false });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
}

/**
 * Manual-payment intake. The server re-validates plan and amount — the client
 * only picks a plan id; price and status are set here. Requires auth, stores
 * the receipt privately under the user's own prefix.
 */
export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;
  const userId = user!.id;

  if ((process.env.FEATURE_PAYMENTS || "").toLowerCase() !== "true") {
    return NextResponse.json({ error: "Payments are disabled" }, { status: 404 });
  }
  if (rateLimited(userId)) {
    return NextResponse.json({ error: "Too many attempts — wait a few minutes" }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Multipart form required" }, { status: 400 });
  }

  const planId = String(form.get("planId") || "").trim();
  const method = String(form.get("method") || "").trim();
  const trxId = String(form.get("trxId") || "").trim();
  const receipt = form.get("receipt");

  if (!/^[a-z0-9_-]{1,32}$/i.test(planId) || !/^khqr|aba|other-bank$/i.test(method) || trxId.length < 4 || trxId.length > 128) {
    return NextResponse.json({ error: "Invalid payment details" }, { status: 400 });
  }
  if (!(receipt instanceof File) || receipt.size === 0) {
    return NextResponse.json({ error: "Receipt image is required" }, { status: 400 });
  }
  if (receipt.size > MAX_RECEIPT_BYTES) {
    return NextResponse.json({ error: "Receipt file too large (max 5 MB)" }, { status: 400 });
  }
  const ext = ALLOWED_MIME.get(receipt.type) || null;
  if (!ext) {
    return NextResponse.json({ error: "Unsupported receipt file type" }, { status: 400 });
  }

  // Server-side price: the client's amount is never trusted.
  const { data: plan } = await supabaseAdmin.from("plans").select("id, price_usd").eq("id", planId).maybeSingle();
  if (!plan) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }
  const amount = Number(plan.price_usd) || 0;

  try {
    await ensureReceiptsBucket();
    const receiptPath = `${userId}/${randomUUID()}.${ext}`;
    const buf = Buffer.from(await receipt.arrayBuffer());
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(receiptPath, buf, { contentType: receipt.type, upsert: false });
    if (upErr) throw upErr;

    const { data, error: insErr } = await supabaseAdmin
      .from("payment_submissions")
      .insert({
        user_id: userId,
        plan_id: planId,
        amount,
        method: method || null,
        receipt_path: receiptPath,
        trx_id: trxId,
        status: "pending",
      })
      .select("id, status")
      .single();
    if (insErr) {
      if (/duplicate key/i.test(insErr.message)) {
        return NextResponse.json({ error: "This transaction id was already submitted" }, { status: 409 });
      }
      throw insErr;
    }

    await logActivity({
      userId,
      workspaceId: null,
      type: "payment",
      action: "submit",
      title: `Submitted payment for plan "${planId}"`,
      detail: `trx ${trxId}`,
      status: "info",
    });

    return NextResponse.json({ ok: true, id: data!.id, status: data!.status });
  } catch (e: any) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}
