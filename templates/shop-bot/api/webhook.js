// Telegram webhook handler for a simple shop bot.
// Deploy this repo to Vercel, then point your bot's webhook at:
//   https://<your-deployment>.vercel.app/api/webhook
//
// This file holds ALL of the bot's logic. Everyday changes (shop name, products,
// prices, payment method) belong in /config/bot.json, not here.

const crypto = require("crypto");
const { sendMessage, answerCallbackQuery, sendInvoice, answerPreCheckoutQuery } = require("../lib/telegram");
const config = require("../config/bot.json");

function t(km, en) {
  if (config.language === "en") return en;
  if (config.language === "both") return `${km}\n${en}`;
  return km;
}

function formatPrice(p) {
  return p.currency === "KHR" ? `${p.price.toLocaleString()} ៛` : `$${p.price}`;
}

/**
 * Telegram charges in the currency's smallest unit: cents for USD, but KHR is
 * a zero-decimal currency so whole riel is correct there.
 */
function toMinorUnits(price, currency) {
  const n = Number(price) || 0;
  return currency === "KHR" ? Math.round(n) : Math.round(n * 100);
}

/** Messages are sent with parse_mode HTML, so customer-typed text must be escaped. */
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function productListKeyboard() {
  return {
    inline_keyboard: config.products.map((p, i) => [
      { text: `${p.name} — ${formatPrice(p)}`, callback_data: `select:${i}` },
    ]),
  };
}

async function handleStart(chatId) {
  await sendMessage(
    chatId,
    `👋 <b>${config.botName}</b>\n${config.description}\n\n` +
      t("សូមជ្រើសរើសទំនិញខាងក្រោម៖", "Please choose a product below:"),
    { reply_markup: productListKeyboard() }
  );
}

async function handleSelect(chatId, idx) {
  const p = config.products[idx];
  if (!p) return;
  await sendMessage(
    chatId,
    `<b>${p.name}</b> — ${formatPrice(p)}\n${p.description || ""}`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: t("កម្ម៉ង់ទំនិញនេះ 🛒", "Order this 🛒"), callback_data: `order:${idx}` }]],
      },
    }
  );
}

async function handleOrderStart(chatId, idx) {
  const p = config.products[idx];
  if (!p) return;
  // The "[PID:n]" marker is how we recognize, stateless, which product a later
  // plain-text reply belongs to — Telegram echoes the original message back as
  // `reply_to_message` when the user replies to this one.
  await sendMessage(
    chatId,
    t(
      `សូមឆ្លើយតបសារនេះ (reply) ដោយផ្ញើ៖ ឈ្មោះ, លេខទូរស័ព្ទ, អាសយដ្ឋាន\nសម្រាប់៖ ${p.name}`,
      `Please reply to this message with: Name, Phone number, Address\nFor: ${p.name}`
    ) + `\n\n[PID:${idx}]`,
    { reply_markup: { force_reply: true } }
  );
}

async function handleOrderDetails(chatId, from, idx, detailsText) {
  const p = config.products[idx];
  if (!p) return;

  const name = escapeHtml(p.name);

  await sendMessage(
    chatId,
    t(
      `✅ បានទទួលការកម្ម៉ង់របស់អ្នកសម្រាប់ <b>${name}</b> (${formatPrice(p)}).`,
      `✅ Your order for <b>${name}</b> (${formatPrice(p)}) has been received.`
    )
  );

  await sendPaymentStep(chatId, p, idx);

  const adminChatId = process.env.ADMIN_CHAT_ID;
  if (adminChatId) {
    const who = from.username ? `@${from.username}` : from.first_name || "customer";
    await sendMessage(
      adminChatId,
      `🛎 <b>New order</b>\nProduct: ${name} (${formatPrice(p)})\nFrom: ${escapeHtml(who)}\nDetails: ${escapeHtml(detailsText)}`
    );
  }
}

/**
 * Sends a native Telegram invoice when the seller chose that method and
 * PAYMENT_PROVIDER_TOKEN is configured. If the charge fails (most commonly
 * because the provider does not support the shop's currency), fall back to the
 * plain instruction text so the customer is never left without a way to pay.
 */
async function sendPaymentStep(chatId, p, idx) {
  const method = config.payment && config.payment.method;

  if (method === "telegram_invoice" && process.env.PAYMENT_PROVIDER_TOKEN) {
    try {
      await sendInvoice(chatId, {
        title: String(p.name).slice(0, 32),
        description: String(p.description || config.botName || "Order").slice(0, 250),
        payload: `order:${idx}:${chatId}:${Date.now()}`,
        currency: p.currency === "KHR" ? "KHR" : "USD",
        prices: [{ label: String(p.name).slice(0, 32), amount: toMinorUnits(p.price, p.currency) }],
      });
      return;
    } catch (error) {
      console.error("sendInvoice failed:", error && error.message);
      // The invoice did not go out, so promising one would be a lie — fall back
      // to the same wording a manual-payment shop uses.
      await sendMessage(chatId, paymentInstructions("manual"));
      return;
    }
  }

  await sendMessage(chatId, paymentInstructions());
}

function paymentInstructions(overrideMethod) {
  const method = overrideMethod || (config.payment && config.payment.method);
  if (method === "external_link" && config.payment.details) {
    return t(
      `សូមបង់ប្រាក់តាមតំណនេះ៖ ${config.payment.details}`,
      `Please pay using this link: ${config.payment.details}`
    );
  }
  if (method === "telegram_invoice") {
    return t(
      "អ្នកលក់នឹងផ្ញើវិក្កយបត្របង់ប្រាក់មកអ្នកក្នុងពេលឆាប់ៗនេះ។",
      "The seller will send you a payment invoice shortly."
    );
  }
  return t(
    "អ្នកលក់នឹងទាក់ទងអ្នកផ្ទាល់ដើម្បីបញ្ជាក់ការបង់ប្រាក់។",
    "The seller will contact you directly to confirm payment."
  );
}

/** Telegram sends this once a payment has actually gone through. */
async function handleSuccessfulPayment(chatId, from, payment) {
  await sendMessage(chatId, t("✅ បានបង់ប្រាក់រួចរាល់! សូមអរគុណ។", "✅ Payment received — thank you!"));

  const adminChatId = process.env.ADMIN_CHAT_ID;
  if (!adminChatId) return;

  const amount = payment.currency === "KHR" ? `${Number(payment.total_amount).toLocaleString()} ៛` : `$${(payment.total_amount / 100).toFixed(2)}`;
  const who = (from && from.username) ? `@${from.username}` : ((from && from.first_name) || "customer");
  await sendMessage(
    adminChatId,
    `💰 <b>Payment received</b>\nAmount: ${amount}\n` +
      `Ref: ${escapeHtml(payment.provider_payment_charge_id || payment.telegram_payment_charge_id || "-")}\n` +
      `From: ${escapeHtml(who)}`
  );
}

/** Extracts the product index from a force-reply order prompt's text, if present. */
function extractPendingOrderIndex(repliedToText) {
  if (!repliedToText) return null;
  const m = repliedToText.match(/\[PID:(\d+)\]/);
  return m ? Number(m[1]) : null;
}

/**
 * Telegram echoes the secret_token given at setWebhook time back in this header.
 * Without it, anyone who learns the webhook URL could POST fake updates and spam
 * the admin with bogus orders. When TELEGRAM_WEBHOOK_SECRET is unset we keep the
 * old behaviour so existing deployments don't break — see README step 3.
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

    if (update.pre_checkout_query) {
      // Telegram gives us only 10 seconds here. The order was already validated
      // in the chat before the invoice was sent, so accept it.
      await answerPreCheckoutQuery(update.pre_checkout_query.id, true);
    } else if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      await answerCallbackQuery(cb.id, "");
      if (cb.data.startsWith("select:")) {
        await handleSelect(chatId, Number(cb.data.split(":")[1]));
      } else if (cb.data.startsWith("order:")) {
        await handleOrderStart(chatId, Number(cb.data.split(":")[1]));
      }
    } else if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = (msg.text || "").trim();

      if (text === "/start" || text === "/menu") {
        await handleStart(chatId);
      } else if (msg.successful_payment) {
        await handleSuccessfulPayment(chatId, msg.from, msg.successful_payment);
      } else if (msg.reply_to_message) {
        const idx = extractPendingOrderIndex(msg.reply_to_message.text);
        if (idx !== null) {
          await handleOrderDetails(chatId, msg.from, idx, text);
        }
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
