// Proof that the generated-bot templates behave: the FAQ bot matches Khmer and
// English questions, and the shop bot sends real invoices, escapes customer
// text, falls back when a charge fails, and rejects unsigned webhook calls.
//
// Everything the templates would send to Telegram is captured in memory — no
// network, no tokens. Only the templates' own logic is real.
//
// Run: node scripts/test-bot-templates.mjs   (exit 0 = all checks pass)

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const require = createRequire(import.meta.url);

const results = [];
const check = (name, ok) => results.push([name, !!ok]);

/**
 * Loads a template's webhook with its `lib/telegram.js` replaced by a recorder,
 * so every outgoing call is inspectable and none actually leaves the process.
 */
function loadTemplate(dir, { calls = [] } = {}) {
  const sent = calls;
  const stub = {
    sendMessage(chatId, text, extra = {}) {
      sent.push({ type: "sendMessage", chatId, text, extra });
      return Promise.resolve({});
    },
    answerCallbackQuery(id, text) {
      sent.push({ type: "answerCallbackQuery", id, text });
      return Promise.resolve({});
    },
    sendInvoice(chatId, payload) {
      if (stub.invoiceFails) {
        const err = new Error("PAYMENT_PROVIDER_INVALID");
        return Promise.reject(err);
      }
      sent.push({ type: "sendInvoice", chatId, payload });
      return Promise.resolve({});
    },
    answerPreCheckoutQuery(id, ok, errorMessage) {
      sent.push({ type: "answerPreCheckoutQuery", id, ok, errorMessage });
      return Promise.resolve({});
    },
  };

  const base = path.join(root, "templates", dir);
  const tgPath = require.resolve(path.join(base, "lib/telegram.js"));
  require.cache[tgPath] = { id: tgPath, filename: tgPath, loaded: true, exports: stub };

  delete require.cache[require.resolve(path.join(base, "api/webhook.js"))];
  const handler = require(path.join(base, "api/webhook.js"));
  return { handler, stub, sent };
}

function post(handler, update, headers = {}) {
  return new Promise((resolve) => {
    const res = {
      code: 200,
      status(c) {
        this.code = c;
        return this;
      },
      send() {
        resolve(this.code);
      },
    };
    handler({ method: "POST", headers, body: update }, res);
  });
}

const last = (sent) => sent[sent.length - 1];

/* ── FAQ bot ─────────────────────────────────────────────────────────────── */

async function testFaqBot() {
  const sent = [];
  const { handler } = loadTemplate("faq-bot", { calls: sent });
  const config = require(path.join(root, "templates/faq-bot/config/faq.json"));
  config.contact.username = "@seller";
  const reset = () => (sent.length = 0);

  reset();
  await post(handler, { message: { chat: { id: 1 }, text: "/start" } });
  check(
    "faq: /start lists every question plus the contact button",
    last(sent).text.includes(config.botName) &&
      last(sent).extra.reply_markup.inline_keyboard.length === config.questions.length + 1
  );

  reset();
  await post(handler, { message: { chat: { id: 1 }, text: "ម៉ោងបើកប៉ុន្មាន?" } });
  check("faq: a Khmer question reaches its answer", last(sent).text.includes(config.questions[0].answer));

  reset();
  await post(handler, { message: { chat: { id: 1 }, text: "how long is delivery?" } });
  check("faq: an English question reaches its answer", last(sent).text.includes(config.questions[1].answer));

  reset();
  await post(handler, { message: { chat: { id: 1 }, text: "zzzz nonsense" } });
  check("faq: unmatched text falls back to the menu", last(sent).text.includes(config.fallback));

  reset();
  await post(handler, { callback_query: { id: "c1", data: "q:1", message: { chat: { id: 1 } } } });
  check("faq: tapping a question shows its answer", last(sent).text.includes(config.questions[1].answer));

  reset();
  await post(handler, { callback_query: { id: "c2", data: "contact", message: { chat: { id: 1 } } } });
  check("faq: contact button surfaces the seller username", last(sent).text.includes("@seller"));

  reset();
  const badIndex = await post(handler, { callback_query: { id: "c3", data: "q:99", message: { chat: { id: 1 } } } });
  check("faq: an out-of-range question index is ignored, not thrown", badIndex === 200);

  reset();
  await post(handler, { message: { chat: { id: 1 }, text: "<b>hi</b>" } });
  check("faq: customer-typed HTML is escaped", !last(sent).text.includes("<b>hi</b>"));

  process.env.TELEGRAM_WEBHOOK_SECRET = "s3cret";
  reset();
  const wrong = await post(handler, { message: { chat: { id: 1 }, text: "/start" } }, { "x-telegram-bot-api-secret-token": "wrong!" });
  check("faq: a wrong webhook secret is rejected with 401", wrong === 401 && sent.length === 0);

  reset();
  const right = await post(handler, { message: { chat: { id: 1 }, text: "/start" } }, { "x-telegram-bot-api-secret-token": "s3cret" });
  check("faq: the correct webhook secret is accepted", right === 200 && sent.length === 1);
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
}

/* ── Shop bot ────────────────────────────────────────────────────────────── */

async function testShopBot() {
  const sent = [];
  const { handler, stub } = loadTemplate("shop-bot", { calls: sent });
  const config = require(path.join(root, "templates/shop-bot/config/bot.json"));
  const reset = () => (sent.length = 0);

  const order = (details = "Sok, 012345678, Phnom Penh") =>
    post(handler, {
      message: {
        chat: { id: 1 },
        from: { id: 1, username: "customer" },
        text: details,
        reply_to_message: { text: "prompt\n\n[PID:0]" },
      },
    });

  // manual (the template default)
  config.payment = { method: "manual", details: "" };
  reset();
  await order();
  check("shop: an order confirms to the customer", sent.some((c) => /បានទទួលការកម្ម៉ង់/.test(c.text)));
  check("shop: manual payment asks the seller to confirm", sent.some((c) => /ទាក់ទងអ្នកផ្ទាល់/.test(c.text)));

  // customer-typed details must not be able to inject markup into the admin alert
  process.env.ADMIN_CHAT_ID = "999";
  reset();
  await order("<b>bold</b>");
  const adminAlert = sent.find((c) => c.chatId === "999");
  check("shop: admin alert escapes customer-supplied details", !!adminAlert && !adminAlert.text.includes("<b>bold</b>"));
  delete process.env.ADMIN_CHAT_ID;

  // external payment link
  config.payment = { method: "external_link", details: "https://pay.example/khqr/abc" };
  reset();
  await order();
  check("shop: external link payment sends the link", last(sent).text.includes("https://pay.example/khqr/abc"));

  // telegram invoice, provider configured
  config.payment = { method: "telegram_invoice", details: "" };
  process.env.PAYMENT_PROVIDER_TOKEN = "provider-token";
  reset();
  await order();
  const invoice = sent.find((c) => c.type === "sendInvoice");
  check("shop: telegram_invoice sends a real invoice", !!invoice);
  check("shop: USD price is converted to cents", invoice?.payload?.prices?.[0]?.amount === 500);
  check("shop: invoice currency follows the product", invoice?.payload?.currency === "USD");
  check("shop: no plain-text fallback when the invoice succeeded", !sent.some((c) => c.type === "sendMessage" && /ទាក់ទងអ្នកផ្ទាល់/.test(c.text)));

  // KHR is a zero-decimal currency
  const first = config.products[0];
  const originalCurrency = first.currency;
  const originalPrice = first.price;
  first.currency = "KHR";
  first.price = 12000;
  reset();
  await order();
  const khrInvoice = sent.find((c) => c.type === "sendInvoice");
  check("shop: KHR price is not multiplied by 100", khrInvoice?.payload?.prices?.[0]?.amount === 12000);
  check("shop: KHR invoice declares KHR", khrInvoice?.payload?.currency === "KHR");

  // a failed charge must not leave the customer without a way to pay
  stub.invoiceFails = true;
  reset();
  await order();
  check("shop: a failed charge falls back to instructions", sent.some((c) => c.type === "sendMessage" && /ទាក់ទងអ្នកផ្ទាល់/.test(c.text)));
  stub.invoiceFails = false;

  // payment confirmation
  reset();
  await post(handler, {
    message: {
      chat: { id: 1 },
      from: { id: 1, username: "customer" },
      successful_payment: { currency: "USD", total_amount: 500, provider_payment_charge_id: "ref-1" },
    },
  });
  check("shop: a completed payment is thanked", /បានបង់ប្រាក់រួចរាល់/.test(last(sent).text));

  process.env.ADMIN_CHAT_ID = "999";
  reset();
  await post(handler, {
    message: {
      chat: { id: 1 },
      from: { id: 1, username: "customer" },
      successful_payment: { currency: "USD", total_amount: 500, provider_payment_charge_id: "ref-1" },
    },
  });
  const paidAlert = sent.find((c) => c.chatId === "999");
  check("shop: the admin is told the amount and reference", !!paidAlert && paidAlert.text.includes("$5.00") && paidAlert.text.includes("ref-1"));
  delete process.env.ADMIN_CHAT_ID;

  // Telegram's pre-checkout deadline
  reset();
  await post(handler, { pre_checkout_query: { id: "pc1" } });
  const pc = sent.find((c) => c.type === "answerPreCheckoutQuery");
  check("shop: pre_checkout_query is answered ok", !!pc && pc.ok === true);

  process.env.TELEGRAM_WEBHOOK_SECRET = "s3cret";
  reset();
  const wrong = await post(handler, { message: { chat: { id: 1 }, text: "/start" } }, { "x-telegram-bot-api-secret-token": "wrong!" });
  check("shop: a wrong webhook secret is rejected with 401", wrong === 401 && sent.length === 0);
  delete process.env.TELEGRAM_WEBHOOK_SECRET;

  config.payment = { method: "manual", details: "" };
  first.currency = originalCurrency;
  first.price = originalPrice;
}

/* ── Bot type → template wiring ──────────────────────────────────────────── */

async function testTemplateWiring() {
  const fs = await import("node:fs");
  const src = fs.readFileSync(path.join(root, "lib/bot-builder/template-filler.ts"), "utf-8");
  check("wiring: a FAQ bot is built from the faq-bot template", /chat:\s*"faq-bot"/.test(src));
  check("wiring: the shop template is still the default", /shop:\s*"shop-bot"/.test(src));
  check("wiring: content files are scoped per template", /"faq-bot":\s*new Set\(\["config\/faq\.json"\]\)/.test(src));
  check(
    "wiring: each template declares the config file it must have",
    fs.existsSync(path.join(root, "templates/faq-bot/config/faq.json")) &&
      fs.existsSync(path.join(root, "templates/shop-bot/config/bot.json"))
  );
}

/* ── Config validation (what the admin panel is allowed to save) ─────────── */

async function testConfigValidation() {
  const fs = await import("node:fs");
  const ts = (await import("typescript")).default;

  const src = fs.readFileSync(path.join(root, "lib/bot-builder/config.ts"), "utf-8");
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const module = { exports: {} };
  new Function("exports", "module", outputText)(module.exports, module);
  const { parseBotConfig, serializeBotConfig } = module.exports;

  const good = {
    botName: "Coffee Shop",
    language: "km",
    description: "hi",
    products: [{ name: "Latte", price: 1.5, currency: "USD" }],
    payment: { method: "external_link", details: "https://pay.example/x" },
    adminTelegramUsername: "@me",
  };

  check("config: a well-formed catalogue is accepted", "config" in parseBotConfig(good));

  check("config: a missing shop name is rejected", "error" in parseBotConfig({ ...good, botName: "  " }));
  check("config: a non-object is rejected", "error" in parseBotConfig("nope"));
  check("config: an array is rejected", "error" in parseBotConfig([]));
  check(
    "config: a product without a name is rejected",
    "error" in parseBotConfig({ ...good, products: [{ name: "", price: 1, currency: "USD" }] })
  );
  check(
    "config: a negative price is rejected",
    "error" in parseBotConfig({ ...good, products: [{ name: "X", price: -5, currency: "USD" }] })
  );
  check(
    "config: a non-numeric price is rejected",
    "error" in parseBotConfig({ ...good, products: [{ name: "X", price: "cheap", currency: "USD" }] })
  );
  check(
    "config: an unknown payment method falls back to manual",
    parseBotConfig({ ...good, payment: { method: "bitcoin" } }).config?.payment?.method === "manual"
  );
  check(
    "config: an unknown currency falls back to USD",
    parseBotConfig({ ...good, products: [{ name: "X", price: 1, currency: "EUR" }] }).config?.products?.[0]?.currency === "USD"
  );
  check(
    "config: an empty product list is allowed",
    "config" in parseBotConfig({ ...good, products: [] })
  );
  check(
    "config: a huge product list is rejected",
    "error" in parseBotConfig({ ...good, products: Array.from({ length: 101 }, (_, i) => ({ name: `P${i}`, price: 1, currency: "USD" })) })
  );

  const parsed = parseBotConfig(good);
  const text = serializeBotConfig(parsed.config);
  check("config: serialized output is round-trippable", JSON.parse(text).botName === "Coffee Shop");
  check("config: serialized output ends with a newline", text.endsWith("}\n"));
}

await testFaqBot();
await testShopBot();
await testTemplateWiring();
await testConfigValidation();

let pass = 0;
for (const [name, ok] of results) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (ok) pass++;
}
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
