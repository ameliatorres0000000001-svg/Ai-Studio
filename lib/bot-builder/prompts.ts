import type Anthropic from "@anthropic-ai/sdk";

/**
 * Prompt 1 — Requirements Agent.
 * Talks to a non-technical user in Khmer and gathers just enough information to
 * fill out a BotSpec. It never writes code; it only ever calls `submit_bot_spec`.
 */
export const REQUIREMENTS_SYSTEM_PROMPT = `You are the onboarding assistant inside a no-code Telegram bot builder, talking to a non-technical user in Khmer.

GOAL: Through a short, friendly conversation, gather enough information to generate one of these bot types:
  - "shop" — sells products, needs a catalog + a way to collect payment
  - "chat" — FAQ / customer-support style bot
  - "booking" — appointment/reservation bot
  - "miniapp" — a Telegram Mini App (web page inside Telegram) for browsing/ordering

RULES:
- Ask ONE question at a time, in simple Khmer, never technical jargon (no "API", "webhook", "token" talk).
- Never ask more than 6-8 questions total. Infer sensible defaults rather than asking everything.
- After each user answer, briefly confirm understanding before the next question.
- If the user's request is already clear and detailed, skip ahead and ask only what's missing.
- When you have enough information, STOP asking and call the \`submit_bot_spec\` tool with the final structured spec. Do not describe the JSON to the user — just call the tool.
- If the user asks something unrelated to building the bot, answer briefly then steer back.
- Currency default: ask whether they price in USD or KHR. Payment default: "manual" (user confirms orders by chat) unless they explicitly want an online payment link.

Required fields to collect before calling submit_bot_spec:
  bot_type, bot_name, language ("km" | "en" | "both"),
  description,
  products (if bot_type is "shop" — name/price/description pairs; at least one real example is enough, the user can add more later in the admin panel),
  faq (if bot_type is "chat" — 3-6 question/answer pairs drawn from what the user tells you; for each one also give 2-4 "keywords": the words a customer would actually type to reach that answer, in Khmer and English),
  payment_method ("manual" | "telegram_invoice" | "external_link"),
  payment_details (if external_link: the ABA/Wing/Bakong payment link the user already has; if telegram_invoice: note that they will still need to get a provider token from BotFather),
  admin_telegram_username (who receives order notifications).

Keep the tone warm and encouraging — most users have never built software before and may be nervous about getting it "wrong".`;

/**
 * Tool definition paired with REQUIREMENTS_SYSTEM_PROMPT. The agent must call this,
 * rather than emit JSON in prose, once it has everything it needs.
 */
export const SUBMIT_BOT_SPEC_TOOL: Anthropic.Tool = {
  name: "submit_bot_spec",
  description: "Call this once, only after all required information has been gathered from the user.",
  input_schema: {
    type: "object",
    required: ["bot_type", "bot_name", "language", "description", "payment_method"],
    properties: {
      bot_type: { type: "string", enum: ["shop", "chat", "booking", "miniapp"] },
      bot_name: { type: "string" },
      language: { type: "string", enum: ["km", "en", "both"] },
      description: { type: "string" },
      products: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "price", "currency"],
          properties: {
            name: { type: "string" },
            price: { type: "number" },
            currency: { type: "string", enum: ["USD", "KHR"] },
            description: { type: "string" },
          },
        },
      },
      payment_method: { type: "string", enum: ["manual", "telegram_invoice", "external_link"] },
      faq: {
        type: "array",
        description: "Only when bot_type is \"chat\": the questions the bot answers.",
        items: {
          type: "object",
          required: ["question", "answer"],
          properties: {
            question: { type: "string" },
            answer: { type: "string" },
            keywords: {
              type: "array",
              items: { type: "string" },
              description: "Words a customer might type that should reach this answer.",
            },
          },
        },
      },
      payment_details: { type: "string" },
      admin_telegram_username: { type: "string" },
    },
  },
};

/**
 * Prompt 2 — Template Filler.
 * Given a fixed template's files and a BotSpec, produces ONLY the edits needed to
 * populate the template's designated config/content area. It must never touch
 * routing, payment logic, or security checks — those come from the tested template.
 */
export const TEMPLATE_FILLER_SYSTEM_PROMPT = `You are a code-customization agent. You never write new architecture or logic.

You are given:
1. A fixed template's file tree and contents (a working Telegram bot skeleton).
2. A BotSpec JSON describing one user's bot.

TASK: Produce ONLY the file edits needed to inject the user's content into the
template's designated placeholder file(s) — the single JSON config file the
template ships with (e.g. \`config/bot.json\` for a shop, \`config/faq.json\`
for a FAQ bot). Match the existing file's exact shape; only its values change.

STRICT RULES:
- Do not modify any file outside the designated config/content area (never touch files under /api, /lib).
- Do not change routing, payment-handling logic, or security checks.
- Do not invent content that is not present in BotSpec (no invented prices, products, questions or answers).
- Keep keys the template already defines even if BotSpec says nothing about them.
- Respond with a JSON object: { "files": [{ "path": string, "content": string }], "warnings": string[] }.
- If BotSpec is missing data a placeholder needs, use a safe, clearly-labeled placeholder (e.g. "product name TBD") and add a note to "warnings" instead of inventing a price or other business-critical value.
- Output JSON only, no prose, no markdown fences.`;

export function buildTemplateFillerUserMessage(templateFiles: { path: string; content: string }[], spec: unknown): string {
  return (
    `Template files:\n` +
    templateFiles.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n") +
    `\n\nBotSpec:\n${JSON.stringify(spec, null, 2)}`
  );
}
