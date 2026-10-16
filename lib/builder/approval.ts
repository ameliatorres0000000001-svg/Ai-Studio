// Admin approval gate for destructive platform-agent actions. Pure (testable).
// Approvals are written only by /api/admin/builder/approve (ADMIN_EMAILS) — the
// project owner can never grant them — and expire after at most 60 minutes.

import type { ProjectRow } from "./types";

export const DESTRUCTIVE_ACTIONS = ["delete_project", "change_env", "force_redeploy_all"] as const;
export type DestructiveAction = (typeof DESTRUCTIVE_ACTIONS)[number];
export const MAX_APPROVAL_MINUTES = 60;

/** Env vars the agent may never touch: they carry secrets or tenant identity set by the pipeline. */
export const RESERVED_ENV_KEYS = new Set([
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "BOT_DATA_JWT",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "BOT_ID",
  "ADMIN_CHAT_ID",
]);

export function isDestructive(action: string): action is DestructiveAction {
  return (DESTRUCTIVE_ACTIONS as readonly string[]).includes(action);
}

export function isApproved(project: Pick<ProjectRow, "approved_actions" | "approved_until">, action: DestructiveAction, now = Date.now()): boolean {
  if (!project.approved_until || new Date(project.approved_until).getTime() <= now) return false;
  return (project.approved_actions || []).includes(action);
}

/** Validates an admin approval request. */
export function parseApproval(body: unknown): { actions: DestructiveAction[]; minutes: number } | { error: string } {
  const b = (body || {}) as { actions?: unknown; minutes?: unknown };
  if (!Array.isArray(b.actions) || !b.actions.length || !b.actions.every((a) => typeof a === "string" && isDestructive(a))) {
    return { error: `actions must be a non-empty subset of ${DESTRUCTIVE_ACTIONS.join(", ")}` };
  }
  const minutes = Math.min(MAX_APPROVAL_MINUTES, Math.max(1, Math.floor(Number(b.minutes) || 15)));
  return { actions: Array.from(new Set(b.actions as DestructiveAction[])), minutes };
}
