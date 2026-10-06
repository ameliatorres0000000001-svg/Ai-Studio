// SERVER-ONLY. TELEGRAM_BOT_TOKEN is read from the environment and never leaves the server:
// it is not stored in the database, not returned by any route, and not placed in any error
// message (errors below are fixed strings; Telegram's own `description` never contains it).
//
// Telegram is an OPTIONAL connector: nothing in the core app imports this module.

const API = "https://api.telegram.org";
const TIMEOUT_MS = 10_000;

export function isTelegramConfigured(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN?.trim();
}

export class TelegramError extends Error {
  constructor(message: string, public readonly code?: number) {
    super(message);
    this.name = "TelegramError";
  }
}

export interface TelegramBot {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
}

async function call<T>(method: string, payload: Record<string, unknown> = {}): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new TelegramError("TELEGRAM_BOT_TOKEN is not configured on the server");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
    let body: { ok?: boolean; result?: T; description?: string; error_code?: number } | null = null;
    try {
      body = await res.json();
    } catch {
      /* non-JSON body */
    }
    if (!res.ok || !body?.ok) {
      throw new TelegramError(
        body?.description || `Telegram API error (${res.status})`,
        body?.error_code ?? res.status
      );
    }
    return body.result as T;
  } catch (e) {
    if (e instanceof TelegramError) throw e;
    if (controller.signal.aborted) throw new TelegramError("Telegram API request timed out");
    // Network-level failures: never forward the raw error (its message/cause can embed the URL).
    throw new TelegramError("Could not reach the Telegram API");
  } finally {
    clearTimeout(timer);
  }
}

/** Verifies the token. Throws TelegramError("Unauthorized") for an invalid token. */
export function getMe(): Promise<TelegramBot> {
  return call<TelegramBot>("getMe");
}

/** Verifies the bot can access a chat. `chatId` is a numeric id or @channelusername. */
export function getChat(chatId: string): Promise<TelegramChat> {
  return call<TelegramChat>("getChat", { chat_id: chatId });
}

export function sendMessage(chatId: string, text: string): Promise<{ message_id: number }> {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
}

/** Numeric chat id (users, groups, supergroups: negative) or a public @username. */
const CHAT_ID_RE = /^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/;

export function normalizeChatId(input: unknown): string | null | "invalid" {
  if (input === undefined || input === null) return null;
  if (typeof input !== "string") return "invalid";
  const v = input.trim();
  if (!v) return null;
  return CHAT_ID_RE.test(v) ? v : "invalid";
}

export function chatTitle(chat: TelegramChat): string | null {
  return chat.title || chat.username || chat.first_name || null;
}
