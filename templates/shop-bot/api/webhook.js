// Telegram webhook handler for a simple shop bot.
// Deploy this repo to Vercel, then point your bot's webhook at:
//   https://<your-deployment>.vercel.app/api/webhook
//
// This file holds ALL of the bot's logic. Everyday changes (shop name, products,
// prices, payment method) belong in /config/bot.json, not here.

const { sendMessage, answerCallbackQuery } = require("../lib/telegram");
const config = require("../config/bot.json");

function t(km, en) {
  if (config.language === "en") return en;
  if (config.language === "both") return `${km}\n${en}`;
  return km;
}

function formatPrice(p) {
  return p.currency === "KHR" ? `${p.price.toLocaleString()} ៛` : `$${p.price}`;
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

  await sendMessage(
    chatId,
    t(
      `✅ បានទទួលការកម្ម៉ង់របស់អ្នកសម្រាប់ <b>${p.name}</b> (${formatPrice(p)}).`,
      `✅ Your order for <b>${p.name}</b> (${formatPrice(p)}) has been received.`
    ) + "\n\n" + paymentInstructions()
  );

  const adminChatId = process.env.ADMIN_CHAT_ID;
  if (adminChatId) {
    const who = from.username ? `@${from.username}` : from.first_name || "customer";
    await sendMessage(
      adminChatId,
      `🛎 <b>New order</b>\nProduct: ${p.name} (${formatPrice(p)})\nFrom: ${who}\nDetails: ${detailsText}`
    );
  }
}

function paymentInstructions() {
  const method = config.payment && config.payment.method;
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

/** Extracts the product index from a force-reply order prompt's text, if present. */
function extractPendingOrderIndex(repliedToText) {
  if (!repliedToText) return null;
  const m = repliedToText.match(/\[PID:(\d+)\]/);
  return m ? Number(m[1]) : null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(200).send("ok");
    return;
  }

  try {
    const update = req.body;

    if (update.callback_query) {
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
