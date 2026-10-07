import crypto from "crypto";

// SERVER-ONLY. Telegram Login Widget verification + helpers.

const MAX_AUTH_AGE_SECONDS = 86400; // 24h

export interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export class TelegramAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelegramAuthError";
  }
}

/**
 * Verifies Telegram Login Widget data via HMAC-SHA256.
 * @see https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramAuth(
  botToken: string,
  data: Record<string, unknown>
): TelegramAuthData {
  const { hash, ...rest } = data as any;

  if (!hash || typeof hash !== "string") {
    throw new TelegramAuthError("Missing hash");
  }

  const secretKey = crypto.createHash("sha256").update(botToken).digest();

  const dataCheckString = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join("\n");

  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const computedBuf = Buffer.from(computedHash, "hex");
  const receivedBuf = Buffer.from(hash, "hex");
  if (
    computedBuf.length !== receivedBuf.length ||
    !crypto.timingSafeEqual(computedBuf, receivedBuf)
  ) {
    throw new TelegramAuthError("Invalid hash — authentication data may be tampered with");
  }

  const authDate = Number(rest.auth_date);
  if (!authDate || isNaN(authDate)) {
    throw new TelegramAuthError("Missing or invalid auth_date");
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > MAX_AUTH_AGE_SECONDS) {
    throw new TelegramAuthError("Authentication data has expired");
  }

  return {
    id: Number(rest.id),
    first_name: rest.first_name,
    last_name: rest.last_name,
    username: rest.username,
    photo_url: rest.photo_url,
    auth_date: authDate,
    hash,
  };
}

/** Optional comma-separated TELEGRAM_ALLOWED_USER_IDS allowlist. Empty = allow all. */
export function isTelegramUserAllowed(telegramId: number): boolean {
  const raw = process.env.TELEGRAM_ALLOWED_USER_IDS || "";
  const allowed = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => !isNaN(n));
  if (allowed.length === 0) return true;
  return allowed.includes(telegramId);
}

/** Deterministic email for a Telegram user so Supabase auth can manage the account. */
export function telegramEmail(telegramId: number): string {
  return `tg_${telegramId}@telegram.local`;
}
