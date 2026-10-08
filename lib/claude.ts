import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import { readFileTree, resolveInside, writeFileContent, redactSecrets } from "./workspace";

// SERVER-ONLY. The API key is read from the environment and never leaves the server.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
const BASE_URL = process.env.ANTHROPIC_BASE_URL;
const MAX_TOKENS = Number(process.env.ANTHROPIC_MAX_TOKENS) || 8192;
const MAX_CONTEXT_FILE_CHARS = 60_000;
const MAX_TREE_CHARS = 20_000;

export function isClaudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");
  return new Anthropic({
    apiKey: key,
    ...(BASE_URL ? { baseURL: BASE_URL } : {}),
  });
}

const SYSTEM_PROMPT = `You are Claude Code, an AI coding assistant integrated into Claude Code Studio.
You help developers manage and edit their GitHub repositories.

When asked to edit code:
- Output the exact file path and the complete new file content in this format:
  <<<FILE:path>>>
  <full file content>
  <<<ENDFILE>>>
- You may output multiple file blocks.
- Always output the COMPLETE file, not just the changed parts.

When asked to explain or analyze:
- Provide a clear, concise explanation.

When asked to run commands:
- Suggest the exact command the user should run. Do not claim you ran it.

Always be direct and technical. Do not add unnecessary commentary.`;

export interface ClaudeResponse {
  text: string;
  filesChanged: { path: string; content: string }[];
  diff: string | null;
}

export async function sendToClaude(
  localPath: string,
  message: string,
  context?: {
    currentFile?: string;
    fileContent?: string;
    /** Set only when the optional Telegram connector is connected AND the request mentions Telegram. */
    telegram?: { botUsername: string | null };
  }
): Promise<ClaudeResponse> {
  const client = getClient();

  let userContent = message;

  if (context?.telegram) {
    const bot = context.telegram.botUsername ? `@${context.telegram.botUsername}` : "a bot";
    userContent +=
      `\n\n--- Telegram connector (connected: ${bot}) ---\n` +
      "The user has connected a Telegram bot and is asking for Telegram-related work. " +
      "Use the Telegram Bot API. The bot token must be read from an environment variable " +
      "(conventionally TELEGRAM_BOT_TOKEN) and must never be hardcoded, printed, logged or committed. " +
      "You do not have the token's value.";
  }

  if (context?.currentFile && context?.fileContent) {
    userContent += `\n\n--- Current file: ${context.currentFile} ---\n${String(context.fileContent).slice(0, MAX_CONTEXT_FILE_CHARS)}`;
  }

  const tree = readFileTree(localPath);
  const fileTreeText = JSON.stringify(tree).slice(0, MAX_TREE_CHARS);
  userContent += `\n\n--- Project file tree ---\n${fileTreeText}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");

  const filesChanged: { path: string; content: string }[] = [];
  const fileRegex = /<<<FILE:(.+?)>>>\n([\s\S]*?)\n<<<ENDFILE>>>/g;
  let match;
  while ((match = fileRegex.exec(text)) !== null) {
    const filePath = match[1].trim();
    const fileContent = match[2];
    try {
      resolveInside(localPath, filePath); // rejects traversal / absolute paths
    } catch {
      continue; // ignore unsafe paths proposed by the model
    }
    if (filePath.split("/").includes(".git")) continue;
    filesChanged.push({ path: filePath, content: fileContent });
  }

  let diff: string | null = null;
  if (filesChanged.length > 0) {
    const parts: string[] = [];
    for (const f of filesChanged) {
      const fullPath = resolveInside(localPath, f.path);
      let oldContent = "";
      if (fs.existsSync(fullPath)) {
        oldContent = fs.readFileSync(fullPath, "utf-8");
      }
      parts.push(`diff --git a/${f.path} b/${f.path}`);
      if (oldContent) {
        parts.push("--- a/" + f.path);
        parts.push("+++ b/" + f.path);
        const oldLines = oldContent.split("\n");
        const newLines = f.content.split("\n");
        parts.push(`@@ -1,${oldLines.length} +1,${newLines.length} @@`);
        oldLines.forEach((l) => parts.push("-" + l));
        newLines.forEach((l) => parts.push("+" + l));
      } else {
        parts.push("--- /dev/null");
        parts.push("+++ b/" + f.path);
        f.content.split("\n").forEach((l) => parts.push("+" + l));
      }
    }
    diff = parts.join("\n");
  }

  return { text, filesChanged, diff };
}

export function stripFileBlocks(text: string, applied: boolean): string {
  return text.replace(
    /<<<FILE:(.+?)>>>\n[\s\S]*?\n<<<ENDFILE>>>/g,
    (_m, p) => (applied ? `[Applied changes to ${String(p).trim()}]` : `[Proposed changes to ${String(p).trim()}]`)
  );
}

export function sanitizeError(e: unknown): string {
  return redactSecrets(e instanceof Error ? e.message : String(e));
}

export function applyChanges(
  localPath: string,
  files: { path: string; content: string }[]
): void {
  for (const f of files) {
    writeFileContent(localPath, f.path, f.content);
  }
}
