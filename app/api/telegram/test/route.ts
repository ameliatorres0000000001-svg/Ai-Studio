import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { isTelegramConfigured, getMe, sendMessage, TelegramError } from "@/lib/telegram";
import {
  getTelegramConnection,
  saveTelegramConnection,
  toPublicStatus,
} from "@/lib/telegram-connection";
import { logActivity } from "@/lib/activities";
import { errorResponse } from "@/lib/route-helpers";
import { redactSecrets } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * Re-verifies a connected bot against the real Telegram API. If a destination chat was
 * chosen, also sends it a short test message (this is an explicit user click).
 */
export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;
  const userId = user!.id;

  try {
    const row = await getTelegramConnection(userId);
    if (!row || row.status === "disconnected") {
      return NextResponse.json({ error: "Telegram is not connected" }, { status: 409 });
    }
    if (!isTelegramConfigured()) {
      return NextResponse.json(
        {
          error: "Telegram bot token is not configured on the server",
          setupRequired: true,
          envVars: ["TELEGRAM_BOT_TOKEN"],
        },
        { status: 400 }
      );
    }

    let sentToChat = false;
    try {
      const bot = await getMe();
      if (row.bot_id != null && bot.id !== row.bot_id) {
        throw new TelegramError(
          "The server's bot token now belongs to a different bot. Disconnect and connect again"
        );
      }
      if (row.chat_id) {
        await sendMessage(
          row.chat_id,
          "✅ CodingStudio: Telegram connection test succeeded."
        );
        sentToChat = true;
      }
    } catch (e) {
      const message = redactSecrets(e instanceof TelegramError ? e.message : String(e));
      const saved = await saveTelegramConnection(userId, {
        status: "error",
        last_error: message,
        last_checked_at: new Date().toISOString(),
      });
      await logActivity({
        userId,
        workspaceId: null,
        type: "telegram",
        action: "telegram_test_failed",
        title: "Telegram connection test failed",
        error: message.slice(0, 500),
        status: "error",
      });
      return NextResponse.json(
        { error: message, status: toPublicStatus(saved) },
        { status: 502 }
      );
    }

    const saved = await saveTelegramConnection(userId, {
      status: "connected",
      last_error: null,
      last_checked_at: new Date().toISOString(),
    });
    await logActivity({
      userId,
      workspaceId: null,
      type: "telegram",
      action: "telegram_test",
      title: sentToChat
        ? "Telegram connection test passed (message sent)"
        : "Telegram connection test passed",
      status: "success",
    });
    return NextResponse.json({ ...toPublicStatus(saved), sentToChat });
  } catch (e) {
    return errorResponse(e);
  }
}
