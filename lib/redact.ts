// SERVER-ONLY. One scrubber for every string that leaves the server or lands in
// a log, event, audit row or agent context. Dependency-free so the builder
// pipeline (and scripts/test-builder.mjs) can load it directly.

const SECRET_ENV_KEYS = [
  "GITHUB_ACCESS_TOKEN",
  "GITHUB_BOTS_TOKEN",
  "CONNECTOR_ENCRYPTION_KEY",
  "ANTHROPIC_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "VERCEL_TOKEN",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_MANAGER_BOT_TOKEN",
  "TELEGRAM_MANAGED_WEBHOOK_SECRET",
];

/** Secrets decrypted at runtime (bot tokens, webhook secrets) are registered here so they are scrubbed too. */
const runtimeSecrets = new Set<string>();

export function registerSecret(value: string | null | undefined): void {
  if (value && value.length >= 8) runtimeSecrets.add(value);
}

/** Strip known secrets (and credentialed GitHub URLs) from any text before it leaves the server. */
export function redactSecrets(text: string): string {
  if (!text) return text;
  let out = text.replace(/https:\/\/[^@\s/]+@github\.com/gi, "https://***@github.com");
  // Telegram bot tokens look like 123456789:AA... and appear in API URLs as /bot<token>/.
  out = out.replace(/\bbot\d{5,}:[A-Za-z0-9_-]{30,}/g, "bot***");
  out = out.replace(/\b\d{5,}:[A-Za-z0-9_-]{30,}\b/g, "***");
  // JWTs (Supabase keys, per-bot data tokens) and bearer credentials.
  out = out.replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "***");
  out = out.replace(/\b(Bearer|token)\s+[A-Za-z0-9._~+/=-]{16,}/gi, "$1 ***");
  // Encrypted-at-rest payloads are not secret by themselves, but never need to leave either.
  out = out.replace(/\bv1:[A-Za-z0-9+/=]{8,}:[A-Za-z0-9+/=]{8,}:[A-Za-z0-9+/=]{4,}/g, "v1:***");
  for (const key of SECRET_ENV_KEYS) {
    const v = process.env[key];
    if (v && v.length >= 8) out = out.split(v).join("***");
  }
  for (const v of runtimeSecrets) out = out.split(v).join("***");
  return out;
}
