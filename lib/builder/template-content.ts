// Pure template assembly: spec → content file → full file set. No I/O, so the
// test script exercises the real thing. The AI fill (lib/bot-builder/template-filler.ts)
// is optional and always validated here before anything reaches a repo.

import { parseBotConfig, serializeBotConfig } from "../bot-builder/config";
import type { BotSpec } from "../bot-builder/types";
import type { RepoFile, TemplateName } from "./types";

export function templateFor(spec: BotSpec): TemplateName {
  return spec.bot_type === "chat" ? "faq-bot" : "shop-bot";
}

export function contentPath(template: TemplateName): string {
  return template === "faq-bot" ? "config/faq.json" : "config/bot.json";
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Deterministic content straight from the spec (used when no AI fill is available or valid). */
export function contentFromSpec(spec: BotSpec): Record<string, unknown> {
  if (templateFor(spec) === "faq-bot") {
    return {
      botName: str(spec.bot_name, 200) || "FAQ Bot",
      language: spec.language,
      description: str(spec.description, 1000),
      welcome: "សូមស្វាគមន៍! សូមជ្រើសរើសសំណួរខាងក្រោម ឬវាយសំណួររបស់អ្នក។",
      fallback: "សូមទោស ខ្ញុំមិនទាន់យល់សំណួរនេះទេ។ សូមជ្រើសរើសពីបញ្ជីខាងក្រោម។",
      questions: (spec.faq || []).slice(0, 100).map((q) => ({
        question: str(q.question, 300),
        answer: str(q.answer, 2000),
        keywords: Array.isArray(q.keywords) ? q.keywords.filter((k) => typeof k === "string").slice(0, 20) : [],
      })),
      contact: { label: "ទាក់ទងអ្នកលក់", username: str(spec.admin_telegram_username, 64).replace(/^@/, "") },
    };
  }
  return {
    botName: str(spec.bot_name, 200) || "Shop Bot",
    language: spec.language,
    description: str(spec.description, 1000),
    products: (spec.products || []).map((p) => ({ name: p.name, price: p.price, currency: p.currency, ...(p.description ? { description: p.description } : {}) })),
    payment: { method: spec.payment_method, details: str(spec.payment_details, 1000) },
    adminTelegramUsername: str(spec.admin_telegram_username, 200),
  };
}

/** Validates/normalises a content object for a template; null when unusable. */
export function normalizeContent(template: TemplateName, value: unknown): Record<string, unknown> | null {
  if (template === "shop-bot") {
    const parsed = parseBotConfig(value);
    return "config" in parsed ? (parsed.config as unknown as Record<string, unknown>) : null;
  }
  const v = value as Record<string, any> | null;
  if (!v || typeof v !== "object" || typeof v.botName !== "string" || !Array.isArray(v.questions)) return null;
  const questions = v.questions
    .filter((q: any) => q && typeof q.question === "string" && typeof q.answer === "string")
    .slice(0, 100)
    .map((q: any) => ({ question: q.question.slice(0, 300), answer: q.answer.slice(0, 2000), keywords: Array.isArray(q.keywords) ? q.keywords.filter((k: unknown) => typeof k === "string").slice(0, 20) : [] }));
  return {
    botName: v.botName.slice(0, 200),
    language: v.language === "en" || v.language === "both" ? v.language : "km",
    description: typeof v.description === "string" ? v.description.slice(0, 1000) : "",
    welcome: typeof v.welcome === "string" ? v.welcome.slice(0, 1000) : "",
    fallback: typeof v.fallback === "string" ? v.fallback.slice(0, 1000) : "",
    questions,
    contact: { label: str(v.contact?.label, 100) || "ទាក់ទង", username: str(v.contact?.username, 64).replace(/^@/, "") },
  };
}

/**
 * Template files + content file + non-secret runtime info. .env* files are
 * never part of a generated repo — all configuration arrives as Vercel env.
 */
export function assembleFiles(templateFiles: RepoFile[], template: TemplateName, content: Record<string, unknown>, runtime: { botUsername: string | null }): RepoFile[] {
  const byPath = new Map<string, string>();
  for (const f of templateFiles) {
    if (/(^|\/)\.env(\.|$)/.test(f.path)) continue;
    byPath.set(f.path, f.content);
  }
  const path = contentPath(template);
  byPath.set(path, template === "shop-bot" ? serializeBotConfig(content as any) : `${JSON.stringify(content, null, 2)}\n`);
  if (template === "shop-bot") byPath.set("config/runtime.json", `${JSON.stringify({ botUsername: runtime.botUsername || "" }, null, 2)}\n`);
  return Array.from(byPath.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([p, c]) => ({ path: p, content: c }));
}
