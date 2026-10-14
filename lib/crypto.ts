import crypto from "crypto";

// SERVER-ONLY. AES-256-GCM for connector tokens. Format: v1:<iv b64>:<tag b64>:<cipher b64>

function getKey(): Buffer {
  const raw = process.env.CONNECTOR_ENCRYPTION_KEY;
  if (!raw) throw new Error("CONNECTOR_ENCRYPTION_KEY is not set (base64, 32 bytes)");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("CONNECTOR_ENCRYPTION_KEY must decode to 32 bytes");
  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Unsupported secret format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(parts[1], "base64"));
  decipher.setAuthTag(Buffer.from(parts[2], "base64"));
  return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64")), decipher.final()]).toString("utf8");
}

/** HMAC-SHA256 signature of a string payload (for OAuth state cookies). */
export function signPayload(payload: string): string {
  return crypto.createHmac("sha256", getKey()).update(payload).digest("base64url");
}

export function verifySignature(payload: string, signature: string): boolean {
  const expected = signPayload(payload);
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
