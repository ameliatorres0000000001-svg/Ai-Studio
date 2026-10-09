import { providerFor } from "./providers";
import { RESEARCH_SYSTEM_PROMPT } from "./prompts";
import type { Effort, ProviderResult, ResolvedModel } from "./types";

// SERVER-ONLY. Research mode: plain chat. Never touches the workspace on disk and never
// writes files; the only repo text the model sees is what the user explicitly attaches.

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_CHARS = 60_000;

export interface Attachment {
  path: string;
  content: string;
}

/** Validates client-supplied attachments. Throws an Error with a user-safe message. */
export function parseAttachments(raw: unknown): Attachment[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error("attachments must be an array");
  if (raw.length > MAX_ATTACHMENTS) {
    throw new Error(`Too many attachments (max ${MAX_ATTACHMENTS})`);
  }
  return raw.map((a) => {
    if (!a || typeof a.path !== "string" || typeof a.content !== "string") {
      throw new Error("Each attachment needs a string path and content");
    }
    return { path: a.path.slice(0, 300), content: a.content.slice(0, MAX_ATTACHMENT_CHARS) };
  });
}

export function sendResearch(
  model: ResolvedModel,
  effort: Effort | undefined,
  message: string,
  attachments: Attachment[]
): Promise<ProviderResult> {
  let content = message;
  for (const a of attachments) {
    content += `\n\n--- Attached file: ${a.path} ---\n${a.content}`;
  }
  return providerFor(model.route.format).send(
    [
      { role: "system", content: RESEARCH_SYSTEM_PROMPT },
      { role: "user", content },
    ],
    model,
    effort
  );
}
