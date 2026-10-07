import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import {
  isTelegramConfigured,
  getMe,
  getChat,
  chatTitle,
  normalizeChatId,
  TelegramError,
  type TelegramBot,
} from "@/lib/telegram";
import { saveTelegramConnection, toPublicStatus } from "@/lib/telegram-connection";
import { logActivity } from "@/lib/activities";
import { errorResponse } from "@/lib/route-helpers";
import { redactSecrets } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * Verifies the server-side bot token with Telegram (getMe), optionally verifies a destination
 * chat (getChat), then stores metadata only. The token is never read from or returned to the browser.
 * Body: { chatId?: string }
 */
export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;
  const userId = user!.id;

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

  let body: { chatId?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine: chat is optional */
  }
  const chatId = normalizeChatId(body?.chatId);
  if (chatId === "invalid") {
    return NextResponse.json(
      { error: "Chat ID must be a number (e.g. 123456789 or -1001234567890) or an @channelusername" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  try {
    let bot: TelegramBot;
    try {
      bot = await getMe();
    } catch (e) {
      return await failConnect(userId, e, "Telegram rejected the bot token");
    }

    let title: string | null = null;
    if (chatId) {
      try {
        title = chatTitle(await getChat(chatId));
      } catch (e) {
        return await failConnect(
          userId,
          e,
          "The bot cannot access that chat. Send /start to the bot (or add it to the group/channel) and try again",
          { bot }
        );
      }
    }

    const row = await saveTelegramConnection(userId, {
      status: "connected",
      bot_id: bot.id,
      bot_username: bot.username ?? null,
      bot_name: bot.first_name ?? null,
      chat_id: chatId,
      chat_title: title,
      last_error: null,
      connected_at: now,
      disconnected_at: null,
      last_checked_at: now,
    });

    await logActivity({
      userId,
      workspaceId: null,
      type: "telegram",
      action: "telegram_connected",
      title: `Telegram connected${bot.username ? ` (@${bot.username})` : ""}`,
      status: "success",
    });

    return NextResponse.json(toPublicStatus(row));
  } catch (e) {
    return errorResponse(e);
  }
}

async function failConnect(
  userId: string,
  cause: unknown,
  fallback: string,
  extra?: { bot?: TelegramBot }
): Promise<NextResponse> {
  const detail = redactSecrets(cause instanceof TelegramError ? cause.message : String(cause));
  const message = `${fallback} (${detail})`;
  try {
    await saveTelegramConnection(userId, {
      status: "error",
      bot_id: extra?.bot?.id ?? null,
      bot_username: extra?.bot?.username ?? null,
      bot_name: extra?.bot?.first_name ?? null,
      chat_id: null,
      chat_title: null,
      last_error: message,
      last_checked_at: new Date().toISOString(),
    });
  } catch {
    /* metadata is best-effort on the failure path; the error below is still returned */
  }
  await logActivity({
    userId,
    workspaceId: null,
    type: "telegram",
    action: "telegram_connect_failed",
    title: "Telegram connection failed",
    error: message.slice(0, 500),
    status: "error",
  });
  return NextResponse.json({ error: message }, { status: 502 });
}
