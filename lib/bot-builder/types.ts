/**
 * Shared types for the no-code "Bot Builder" feature: a guided chat that turns a
 * plain-language description into a BotSpec, which is then used to fill a fixed,
 * pre-tested template (see /templates) rather than generating free-form code.
 */

export type BotType = "shop" | "chat" | "booking" | "miniapp";
export type BotLanguage = "km" | "en" | "both";
export type PaymentMethod = "manual" | "telegram_invoice" | "external_link";

export interface BotProduct {
  name: string;
  price: number;
  currency: "USD" | "KHR";
  description?: string;
}

export interface BotFaqEntry {
  question: string;
  answer: string;
  /** Words a customer would type to reach this answer — lets the bot match free text. */
  keywords?: string[];
}

export interface BotSpec {
  bot_type: BotType;
  bot_name: string;
  language: BotLanguage;
  description: string;
  products?: BotProduct[];
  /** Used when bot_type is "chat": the questions the bot answers. */
  faq?: BotFaqEntry[];
  payment_method: PaymentMethod;
  /** Free text: an ABA/Wing/Bakong payment link, or a note about the Telegram provider token. */
  payment_details?: string;
  /** Telegram @username of the person who should receive order notifications. */
  admin_telegram_username?: string;
}

export interface BotBuilderMessage {
  role: "user" | "assistant";
  content: string;
}

/** Result of one turn of the requirements-gathering conversation. */
export interface BotBuilderTurnResult {
  reply: string;
  done: boolean;
  spec?: BotSpec;
  warnings?: string[];
  usage?: { inputTokens: number; outputTokens: number };
}

export function isBotSpec(value: unknown): value is BotSpec {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.bot_type === "string" &&
    typeof v.bot_name === "string" &&
    typeof v.language === "string" &&
    typeof v.description === "string" &&
    typeof v.payment_method === "string"
  );
}
