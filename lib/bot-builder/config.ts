// Validation for a generated bot's config/bot.json. Shared by the API route
// that writes it, so the studio can never push a malformed catalogue into a
// user's live bot repo.

export interface BotConfigProduct {
  name: string;
  price: number;
  currency: "USD" | "KHR";
  description?: string;
}

export interface BotConfig {
  botName: string;
  language: "km" | "en" | "both";
  description: string;
  products: BotConfigProduct[];
  payment: { method: "manual" | "telegram_invoice" | "external_link"; details: string };
  adminTelegramUsername: string;
}

export const MAX_PRODUCTS = 100;
const MAX_NAME = 200;
const MAX_DESCRIPTION = 1000;
const MAX_PRICE = 100_000_000;

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > max ? null : s;
}

function optionalStr(v: unknown, max: number, fallback = ""): string {
  if (v === undefined || v === null) return fallback;
  return typeof v === "string" ? v.trim().slice(0, max) : fallback;
}

/** Returns a normalized config, or an error string describing what is wrong. */
export function parseBotConfig(value: unknown): { config: BotConfig } | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "config must be an object" };
  }
  const v = value as Record<string, unknown>;

  const botName = str(v.botName, MAX_NAME);
  if (!botName) return { error: "botName is required (max 200 characters)" };

  const description = optionalStr(v.description, MAX_DESCRIPTION);
  const language = v.language === "en" || v.language === "both" ? v.language : "km";

  if (!Array.isArray(v.products)) return { error: "products must be an array" };
  if (v.products.length > MAX_PRODUCTS) {
    return { error: `Too many products (max ${MAX_PRODUCTS})` };
  }

  const products: BotConfigProduct[] = [];
  for (let i = 0; i < v.products.length; i++) {
    const raw = v.products[i] as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") return { error: `Product ${i + 1} is not an object` };
    const name = str(raw.name, MAX_NAME);
    if (!name) return { error: `Product ${i + 1} needs a name` };
    const price = Number(raw.price);
    if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE) {
      return { error: `Product ${i + 1} needs a valid price` };
    }
    const currency = raw.currency === "KHR" ? "KHR" : "USD";
    const item: BotConfigProduct = { name, price, currency };
    const desc = optionalStr(raw.description, MAX_DESCRIPTION);
    if (desc) item.description = desc;
    products.push(item);
  }

  const paymentRaw = (v.payment || {}) as Record<string, unknown>;
  const method =
    paymentRaw.method === "telegram_invoice" || paymentRaw.method === "external_link"
      ? paymentRaw.method
      : "manual";

  return {
    config: {
      botName,
      language,
      description,
      products,
      payment: { method, details: optionalStr(paymentRaw.details, MAX_DESCRIPTION) },
      adminTelegramUsername: optionalStr(v.adminTelegramUsername, MAX_NAME),
    },
  };
}

/** Pretty JSON, 2-space indent, trailing newline — matches the repo's template file. */
export function serializeBotConfig(config: BotConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}
