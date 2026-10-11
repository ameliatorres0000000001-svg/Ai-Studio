// Minimal Telegram Bot API client. No dependencies — uses the global fetch
// available in the Node 18+ runtime that Vercel functions run on.

const API = "https://api.telegram.org";

function token() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return t;
}

async function call(method, payload) {
  const res = await fetch(`${API}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!body || !body.ok) {
    const desc = body && body.description ? body.description : `HTTP ${res.status}`;
    throw new Error(`Telegram API error (${method}): ${desc}`);
  }
  return body.result;
}

function sendMessage(chatId, text, extra = {}) {
  return call("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}

function answerCallbackQuery(callbackQueryId, text) {
  return call("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

module.exports = { sendMessage, answerCallbackQuery };
