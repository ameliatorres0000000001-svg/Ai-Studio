// SERVER-ONLY. Telegram side of the builder: the manager bot (Bot Management
// Mode) and calls made with a managed bot's own token. Tokens are passed in by
// the pipeline (decrypted in memory) and never logged — lib/telegram.ts errors
// carry Telegram's description only, never the URL.

import { callBotApi } from "@/lib/telegram";
import type { BuilderDeps } from "./types";

const BOT_UPDATES = ["message", "callback_query", "pre_checkout_query"];
export const MANAGER_UPDATES = ["managed_bot", "message"];

function managerToken(): string {
  const t = process.env.TELEGRAM_MANAGER_BOT_TOKEN?.trim();
  if (!t) throw new Error("TELEGRAM_MANAGER_BOT_TOKEN is not configured");
  return t;
}

export function isManagerConfigured(): boolean {
  return !!(process.env.TELEGRAM_MANAGER_BOT_TOKEN?.trim() && process.env.TELEGRAM_MANAGER_BOT_USERNAME?.trim() && process.env.TELEGRAM_MANAGED_WEBHOOK_SECRET?.trim());
}

export const telegramAdapter: BuilderDeps["telegram"] = {
  managerUsername() {
    return (process.env.TELEGRAM_MANAGER_BOT_USERNAME || "").trim().replace(/^@/, "");
  },

  async getManagedBotToken(botUserId) {
    const token = await callBotApi<string>(managerToken(), "getManagedBotToken", { user_id: botUserId });
    if (typeof token !== "string" || !token) throw new Error("getManagedBotToken returned no token");
    return token;
  },

  async setWebhook(token, url, secretToken) {
    await callBotApi(token, "setWebhook", {
      url,
      secret_token: secretToken,
      allowed_updates: BOT_UPDATES,
      drop_pending_updates: true,
    });
  },

  async getWebhookInfo(token) {
    return callBotApi<{ url: string; last_error_message?: string; last_error_date?: number }>(token, "getWebhookInfo");
  },

  async setMiniAppMenu(token, url, text) {
    await callBotApi(token, "setChatMenuButton", { menu_button: { type: "web_app", text, web_app: { url } } });
  },

  async sendManagerMessage(chatId, text) {
    await callBotApi(managerToken(), "sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
  },
};

/** One-time admin setup: point the manager bot's webhook at our managed-webhook route. */
export async function setManagerWebhook(url: string): Promise<void> {
  const secret = process.env.TELEGRAM_MANAGED_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("TELEGRAM_MANAGED_WEBHOOK_SECRET is not configured");
  await callBotApi(managerToken(), "setWebhook", { url, secret_token: secret, allowed_updates: MANAGER_UPDATES });
}
