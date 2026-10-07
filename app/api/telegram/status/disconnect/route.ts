import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import {
  getTelegramConnection,
  saveTelegramConnection,
  toPublicStatus,
} from "@/lib/telegram-connection";
import { logActivity } from "@/lib/activities";
import { errorResponse } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

/**
 * Marks the connector disconnected and drops the chosen chat. The bot token lives in the
 * server environment, so removing it entirely is an operator action (unset TELEGRAM_BOT_TOKEN).
 */
export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;
  const userId = user!.id;

  try {
    const row = await getTelegramConnection(userId);
    if (!row) {
      // Nothing was ever connected: idempotent no-op.
      return NextResponse.json(toPublicStatus(null));
    }
    if (row.status === "disconnected") {
      return NextResponse.json(toPublicStatus(row));
    }

    const saved = await saveTelegramConnection(userId, {
      status: "disconnected",
      chat_id: null,
      chat_title: null,
      last_error: null,
      disconnected_at: new Date().toISOString(),
    });
    await logActivity({
      userId,
      workspaceId: null,
      type: "telegram",
      action: "telegram_disconnected",
      title: "Telegram disconnected",
      status: "info",
    });
    return NextResponse.json(toPublicStatus(saved));
  } catch (e) {
    return errorResponse(e);
  }
}
