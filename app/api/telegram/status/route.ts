import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { isTelegramConfigured } from "@/lib/telegram";
import { getTelegramConnection, toPublicStatus } from "@/lib/telegram-connection";

export const dynamic = "force-dynamic";

/**
 * Stored connection state only (no call to Telegram, so it is fast and never blocks anything).
 * Telegram is optional: if the metadata cannot be read (e.g. migration not applied yet) this
 * reports "not_connected" instead of failing.
 */
export async function GET(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const configured = isTelegramConfigured();
  try {
    const row = await getTelegramConnection(user!.id);
    return NextResponse.json(toPublicStatus(row, configured));
  } catch {
    return NextResponse.json({ ...toPublicStatus(null, configured), unavailable: true });
  }
}
