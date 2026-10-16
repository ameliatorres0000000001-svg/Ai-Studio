import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";
import { setManagerWebhook, isManagerConfigured } from "@/lib/builder/telegram-manager";
import { errorResponse } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

/** Admin-only, one time: point the manager bot's webhook at /api/telegram/managed-webhook. */
export async function POST(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;
  if (!isAdminEmail(user?.email)) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  if (!isManagerConfigured()) {
    return NextResponse.json({ error: "Manager bot is not configured", setupRequired: true, envVars: ["TELEGRAM_MANAGER_BOT_TOKEN", "TELEGRAM_MANAGER_BOT_USERNAME", "TELEGRAM_MANAGED_WEBHOOK_SECRET"] }, { status: 400 });
  }
  const base = (process.env.PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/+$/, "");
  try {
    await setManagerWebhook(`${base}/api/telegram/managed-webhook`);
    return NextResponse.json({ ok: true, url: `${base}/api/telegram/managed-webhook` });
  } catch (e) {
    return errorResponse(e, 502);
  }
}
