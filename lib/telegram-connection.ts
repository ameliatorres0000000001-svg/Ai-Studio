import { supabaseAdmin } from "./supabase-server";
import { isTelegramConfigured } from "./telegram";
import type { TelegramStatus } from "./types";

// SERVER-ONLY. Persists connection METADATA only (never the bot token).

export interface TelegramConnectionRow {
  id: string;
  user_id: string;
  status: "connected" | "error" | "disconnected";
  bot_id: number | null;
  bot_username: string | null;
  bot_name: string | null;
  chat_id: string | null;
  chat_title: string | null;
  last_error: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
  last_checked_at: string | null;
}

export async function getTelegramConnection(
  userId: string
): Promise<TelegramConnectionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("telegram_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TelegramConnectionRow | null) ?? null;
}

export async function saveTelegramConnection(
  userId: string,
  patch: Partial<Omit<TelegramConnectionRow, "id" | "user_id">>
): Promise<TelegramConnectionRow> {
  const { data, error } = await supabaseAdmin
    .from("telegram_connections")
    .upsert(
      { user_id: userId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not save Telegram connection");
  return data as TelegramConnectionRow;
}

/** Browser-safe view of a connection. Contains no secrets. */
export function toPublicStatus(
  row: TelegramConnectionRow | null,
  configured: boolean = isTelegramConfigured()
): TelegramStatus {
  return {
    state: row ? row.status : "not_connected",
    configured,
    bot:
      row && row.status !== "disconnected" && row.bot_id != null
        ? { id: row.bot_id, username: row.bot_username, name: row.bot_name }
        : null,
    chat:
      row && row.status !== "disconnected" && row.chat_id
        ? { id: row.chat_id, title: row.chat_title }
        : null,
    connectedAt: row?.connected_at ?? null,
    lastCheckedAt: row?.last_checked_at ?? null,
    lastError: row?.status === "error" ? row.last_error : null,
  };
}
