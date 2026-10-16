// Telegram Managed Bots: link generation and the `managed_bot` update handler.
// Dependency-free (relative imports only) so scripts/test-builder.mjs can load it.
//
// Flow (Bot API 9.6): our manager bot has Bot Management Mode on. We send the user
// https://t.me/newbot/{manager}/{username}?name={name}; they confirm in Telegram,
// so the new bot is theirs. Telegram then sends the manager webhook an update with
// `managed_bot: { user, bot }`, and we fetch the bot token with getManagedBotToken.
// The token is encrypted immediately and never logged, evented or returned.

import { registerSecret, redactSecrets } from "../redact";
import type { BuilderDeps, InstanceRow, ProjectRow } from "./types";

export interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
}

export interface ManagedBotUpdated {
  user: TgUser;
  bot: TgUser;
}

/** Telegram bot usernames: 5–32 chars, [A-Za-z0-9_], must end in "bot". */
const BOT_USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{3,30}bot$/i;

export function isValidBotUsername(u: string): boolean {
  return u.length >= 5 && u.length <= 32 && BOT_USERNAME_RE.test(u);
}

/** Latin-only, unique-ish suggestion such as "angkor_cafe_k3f9_bot" from a (possibly Khmer) name. */
export function suggestBotUsername(name: string, randomSource: string): string {
  const slug = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 18);
  const rand = randomSource.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 4).padEnd(4, "0");
  const base = /^[a-z]/.test(slug) ? slug : `ts_${slug}`.replace(/_+$/, "");
  return `${base || "ts_shop"}_${rand}_bot`.replace(/_+/g, "_").slice(0, 32);
}

export function buildManagedBotLink(managerUsername: string, newUsername: string, name: string): string {
  const manager = managerUsername.replace(/^@/, "");
  return `https://t.me/newbot/${encodeURIComponent(manager)}/${encodeURIComponent(newUsername)}?name=${encodeURIComponent(name.slice(0, 64))}`;
}

/** Telegram-login accounts use the deterministic email tg_<id>@telegram.local (lib/telegram-auth.ts). */
export function telegramIdFromEmail(email: string | null | undefined): number | null {
  const m = (email || "").match(/^tg_(\d{1,20})@telegram\.local$/i);
  return m ? Number(m[1]) : null;
}

export function parseManagedBotUpdate(update: unknown): ManagedBotUpdated | null {
  const mb = (update as { managed_bot?: unknown } | null)?.managed_bot as Partial<ManagedBotUpdated> | undefined;
  if (!mb || typeof mb !== "object") return null;
  const ok = (u: unknown): u is TgUser => !!u && typeof (u as TgUser).id === "number";
  if (!ok(mb.user) || !ok(mb.bot)) return null;
  return { user: mb.user, bot: mb.bot };
}

export type ManagedBotOutcome =
  | { kind: "linked"; projectId: string; username: string | null }
  | { kind: "token_rotated"; projectId: string }
  | { kind: "owner_changed"; projectId: string }
  | { kind: "rejected"; reason: string }
  | { kind: "ignored"; reason: string };

/**
 * Handles one `managed_bot` update. Matches it to a project by the suggested
 * username (new bot) or by telegram_bot_id (token/owner change), fetches and
 * encrypts the token, and reports what happened so the caller can resume or
 * redeploy the run. `expectedCreator` returns the platform user's Telegram id
 * when known (Telegram login); a mismatch is rejected.
 */
export async function handleManagedBotUpdate(
  mb: ManagedBotUpdated,
  deps: Pick<BuilderDeps, "store" | "telegram" | "crypto">,
  expectedCreator: (project: ProjectRow) => Promise<number | null>
): Promise<ManagedBotOutcome> {
  const { store, telegram, crypto } = deps;

  const existing = await store.getInstanceByTelegramId(mb.bot.id);
  if (existing && existing.token_enc) {
    const project = await store.getProject(existing.project_id);
    if (!project) return { kind: "ignored", reason: "instance without project" };
    const token = await telegram.getManagedBotToken(mb.bot.id);
    registerSecret(token);
    const tokenChanged = crypto.decrypt(existing.token_enc) !== token;
    const ownerChanged = existing.owner_telegram_id != null && existing.owner_telegram_id !== mb.user.id;
    const patch: Partial<InstanceRow> = { username: mb.bot.username ?? existing.username };
    if (tokenChanged) {
      patch.token_enc = crypto.encrypt(token);
      // Force a fresh deploy so the new token reaches the runtime env.
      patch.deployed_commit = null;
      patch.deploying_commit = null;
    }
    if (ownerChanged) {
      patch.owner_telegram_id = mb.user.id;
      patch.deployed_commit = null;
      patch.deploying_commit = null;
    }
    await store.upsertInstance(project.id, patch);
    await store.audit({
      actor: "telegram",
      project_id: project.id,
      action: tokenChanged ? "managed_bot.token_rotated" : ownerChanged ? "managed_bot.owner_changed" : "managed_bot.update",
      detail: redactSecrets(`bot @${mb.bot.username ?? mb.bot.id}`),
    });
    if (tokenChanged) return { kind: "token_rotated", projectId: project.id };
    if (ownerChanged) return { kind: "owner_changed", projectId: project.id };
    return { kind: "ignored", reason: "no change" };
  }

  const username = mb.bot.username || "";
  const project = username ? await store.findProjectByPendingUsername(username) : null;
  if (!project) return { kind: "ignored", reason: "no project waiting for this bot" };

  const expected = await expectedCreator(project);
  if (expected != null && expected !== mb.user.id) {
    await store.audit({ actor: "telegram", project_id: project.id, action: "managed_bot.rejected", detail: "creator does not match the project owner's Telegram account" });
    return { kind: "rejected", reason: "creator mismatch" };
  }

  const token = await telegram.getManagedBotToken(mb.bot.id);
  registerSecret(token);
  const current = await store.getInstance(project.id);
  await store.upsertInstance(project.id, {
    telegram_bot_id: mb.bot.id,
    username: mb.bot.username ?? null,
    token_enc: crypto.encrypt(token),
    webhook_secret_enc: current?.webhook_secret_enc ?? crypto.encrypt(crypto.randomSecret()),
    creator_telegram_id: mb.user.id,
    status: "linked",
  });
  await store.audit({ actor: "telegram", project_id: project.id, action: "managed_bot.linked", detail: `bot @${username}` });
  return { kind: "linked", projectId: project.id, username: mb.bot.username ?? null };
}
