import { NextResponse } from "next/server";
import { isTelegramConfigured, getMe } from "@/lib/telegram";
import { errorResponse } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

/**
 * Returns configuration the browser needs to render the Telegram Login Widget:
 * the bot username (fetched from Telegram getMe) and whether the bot token is
 * configured. No auth required — the bot username is public information.
 */
export async function GET() {
  try {
    if (!isTelegramConfigured()) {
      return NextResponse.json({ configured: false, botUsername: null });
    }

    try {
      const bot = await getMe();
      return NextResponse.json({
        configured: true,
        botUsername: bot.username ?? null,
      });
    } catch {
      return NextResponse.json({ configured: true, botUsername: null });
    }
  } catch (e) {
    return errorResponse(e);
  }
}
