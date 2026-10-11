// Telegram webhook handler for a simple FAQ / customer-support bot.
// Deploy this repo to Vercel, then point your bot's webhook at:
//   https://<your-deployment>.vercel.app/api/webhook
//
// This file holds ALL of the bot's logic. Everyday changes (bot name, questions
// and answers, contact username) belong in /config/faq.json, not here.

const crypto = require("crypto");
const { sendMessage, answerCallbackQuery } = require("../lib/telegram");
const config = require("../config/faq.json");

function t(km, en) {
  if (config.language === "en") return en;
  if (config.language === "both") return `${km}\n${en}`;
  return km;
}

/** Messages are sent with parse_mode HTML, so config and user text must be escaped. */
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const questions = Array.isArray(config.questions) ? config.questions : [];

function menuKeyboard() {
  const rows = questions.map((q, i) => [{ text: String(q.question).slice(0, 60), callback_data: `q:${i}` }]);
  if (config.contact && config.contact.username) {
    rows.push([{ text: String(config.contact.label || "Contact").slice(0, 60), callback_data: "contact" }]);
  }
  return { inline_keyboard: rows };
}

async function handleStart(chatId) {
  await sendMessage(
    chatId,
    `👋 <b>${escapeHtml(config.botName)}</b>\n${escapeHtml(config.description || "")}\n\n` +
      escapeHtml(config.welcome || t("សូមជ្រើសរើសសំណួរខាងក្រោម។", "Please pick a question below.")),
    { reply_markup: menuKeyboard() }
  );
}

async function handleAnswer(chatId, idx) {
  const q = questions[idx];
  if (!q) return;
  await sendMessage(
    chatId,
    `<b>${escapeHtml(q.question)}</b>\n\n${escapeHtml(q.answer)}`,
    { reply_markup: menuKeyboard() }
  );
}

async function handleContact(chatId) {
  const username = config.contact && config.contact.username;
  if (!username) return;
  await sendMessage(
    chatId,
    t(
      `សូមទាក់ទង៖ <b>${escapeHtml(username)}</b>`,
      `Please contact: <b>${escapeHtml(username)}</b>`
    )
  );
}

/**
 * Matches free-typed messages against each question's keywords, then against
 * the question text itself, so a customer can just type instead of tapping.
 */
function bestMatch(text) {
  const needle = String(text || "").toLowerCase().trim();
  if (!needle) return -1;

  for (let i = 0; i < questions.length; i++) {
    const keywords = Array.isArray(questions[i].keywords) ? questions[i].keywords : [];
    if (keywords.some((k) => String(k).toLowerCase().trim() && needle.includes(String(k).toLowerCase().trim()))) {
      return i;
    }
  }
  for (let i = 0; i < questions.length; i++) {
    const q = String(questions[i].question || "").toLowerCase().trim();
    if (q && (needle.includes(q) || q.includes(needle))) return i;
  }
  return -1;
}

async function handleText(chatId, text) {
  const idx = bestMatch(text);
  if (idx >= 0) {
    await handleAnswer(chatId, idx);
    return;
  }
  await sendMessage(
    chatId,
    escapeHtml(config.fallback || t("សូមជ្រើសរើសពីបញ្ជីខាងក្រោម។", "Please pick from the list below.")),
    { reply_markup: menuKeyboard() }
  );
}

/**
 * Telegram echoes the secret_token given at setWebhook time back in this header.
 * When TELEGRAM_WEBHOOK_SECRET is unset we keep the old behaviour so existing
 * deployments don't break — see the README.
 */
function isTrustedRequest(req) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true;
  const got = req.headers["x-telegram-bot-api-secret-token"];
  if (typeof got !== "string" || got.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(200).send("ok");
    return;
  }

  if (!isTrustedRequest(req)) {
    res.status(401).send("unauthorized");
    return;
  }

  try {
    const update = req.body;

    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      await answerCallbackQuery(cb.id, "");
      if (cb.data === "contact") {
        await handleContact(chatId);
      } else if (cb.data.startsWith("q:")) {
        await handleAnswer(chatId, Number(cb.data.split(":")[1]));
      }
    } else if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = (msg.text || "").trim();

      if (text === "/start" || text === "/menu") {
        await handleStart(chatId);
      } else if (text && !text.startsWith("/")) {
        await handleText(chatId, text);
      }
    }

    res.status(200).send("ok");
  } catch (err) {
    // Telegram retries on non-2xx, but we don't want infinite retries for a bug —
    // log and still acknowledge receipt.
    console.error(err);
    res.status(200).send("ok");
  }
};
