import fs from "fs";
import path from "path";
import { providerFor } from "@/lib/ai";
import type { ResolvedModel } from "@/lib/ai";
import { TEMPLATE_FILLER_SYSTEM_PROMPT, buildTemplateFillerUserMessage } from "./prompts";
import type { BotSpec } from "./types";

// SERVER-ONLY. Fills the template through the repo's model gateway
// (config/models.json). Plain text in/out, so any route format works.
const MAX_TOKENS = 4096;

export interface FilledFile {
  path: string;
  content: string;
}

export interface TemplateFillResult {
  files: FilledFile[];
  warnings: string[];
  usage: { inputTokens: number; outputTokens: number };
}

const TEMPLATES_ROOT = path.join(process.cwd(), "templates");

/** Reads every file of a template directory (templates/<name>) into memory. */
export function readTemplate(templateName: string): { path: string; content: string }[] {
  const root = path.join(TEMPLATES_ROOT, templateName);
  if (!fs.existsSync(root)) throw new Error(`Unknown template: ${templateName}`);

  const out: { path: string; content: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        out.push({ path: path.relative(root, full), content: fs.readFileSync(full, "utf-8") });
      }
    }
  };
  walk(root);
  return out;
}

const templateForBotType: Record<BotSpec["bot_type"], string> = {
  shop: "shop-bot",
  chat: "faq-bot",
  booking: "shop-bot", // still the shop skeleton — a dedicated template is a follow-up
  miniapp: "shop-bot",
};

/**
 * The only files a generated bot's content may be written into, per template.
 * Everything else in a template is code the user should not be editing blindly.
 */
const CONTENT_FILES: Record<string, Set<string>> = {
  "shop-bot": new Set(["config/bot.json"]),
  "faq-bot": new Set(["config/faq.json"]),
};

function contentFilesFor(templateName: string): Set<string> {
  return CONTENT_FILES[templateName] || CONTENT_FILES["shop-bot"];
}

/**
 * Only this function is allowed to call a model on a template + spec, and it only
 * ever returns edits to the template's declared content files (see
 * CONTENT_FILES above) — never to the handler/payment/security code itself.
 */
export async function fillTemplate(model: ResolvedModel, spec: BotSpec): Promise<TemplateFillResult> {
  const templateName = templateForBotType[spec.bot_type] || "shop-bot";
  const allowed = contentFilesFor(templateName);
  const allFiles = readTemplate(templateName);
  const contentFiles = allFiles.filter((f) => allowed.has(f.path));

  const result = await providerFor(model.route.format).send(
    [
      { role: "system", content: TEMPLATE_FILLER_SYSTEM_PROMPT },
      { role: "user", content: buildTemplateFillerUserMessage(contentFiles, spec) },
    ],
    model,
    undefined,
    { maxTokens: MAX_TOKENS }
  );

  let parsed: { files?: FilledFile[]; warnings?: string[] };
  try {
    parsed = JSON.parse(result.text);
  } catch {
    throw new Error("Template filler returned non-JSON output");
  }

  const files = (parsed.files || []).filter((f) => allowed.has(f.path));
  return { files, warnings: parsed.warnings || [], usage: result.usage };
}

/** All template files with the generated content files merged in, ready to push to a new repo. */
export function mergeTemplateWithFill(templateName: string, filled: FilledFile[]): FilledFile[] {
  const base = readTemplate(templateName);
  const byPath = new Map(base.map((f) => [f.path, f.content]));
  for (const f of filled) byPath.set(f.path, f.content);
  return Array.from(byPath.entries()).map(([p, content]) => ({ path: p, content }));
}
