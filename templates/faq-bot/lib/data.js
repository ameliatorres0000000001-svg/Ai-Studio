// Tenant data client for the shared TeleScripts Supabase project. No
// dependencies: plain fetch against PostgREST. BOT_DATA_JWT carries this bot's
// `bot_id` claim, and row-level security limits every query to this bot's rows.
// All calls are best effort: a data hiccup must never break a customer chat.

const BASE = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const JWT = process.env.BOT_DATA_JWT;
const BOT_ID = process.env.BOT_ID;

function configured() {
  return !!(BASE && ANON && JWT && BOT_ID);
}

async function rest(path, { method = "GET", body, prefer } = {}) {
  if (!configured()) return null;
  const res = await fetch(`${BASE.replace(/\/+$/, "")}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${JWT}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`data ${method} ${path.split("?")[0]}: HTTP ${res.status}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

/** Remembers who talked to the bot (one row per Telegram user per bot). */
async function upsertCustomer(from) {
  if (!from || !from.id) return;
  try {
    await rest("bot_customers?on_conflict=bot_id,telegram_user_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: { bot_id: BOT_ID, telegram_user_id: from.id, username: from.username || null, first_name: from.first_name || null },
    });
  } catch (e) {
    console.error("upsertCustomer failed:", e && e.message);
  }
}

/** Stores an order so the owner sees it in the TeleScripts dashboard. */
async function addOrder({ customerId, product, amount, currency, details }) {
  try {
    await rest("bot_orders", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        bot_id: BOT_ID,
        customer_telegram_id: customerId || null,
        product: String(product || "").slice(0, 200),
        amount: amount == null ? null : Number(amount),
        currency: currency || null,
        details: details ? String(details).slice(0, 2000) : null,
      },
    });
  } catch (e) {
    console.error("addOrder failed:", e && e.message);
  }
}

module.exports = { configured, upsertCustomer, addOrder };
