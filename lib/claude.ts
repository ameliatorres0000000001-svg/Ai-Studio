import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { readFileTree, readFileContent, writeFileContent } from "./workspace";

export function isClaudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");
  return new Anthropic({ apiKey: key });
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
  context?: { currentFile?: string; fileContent?: string }
): Promise<ClaudeResponse> {
  const client = getClient();

  let userContent = message;

  if (context?.currentFile && context?.fileContent) {
    userContent += `\n\n--- Current file: ${context.currentFile} ---\n${context.fileContent}`;
  }

  const tree = readFileTree(localPath);
  const fileTreeText = JSON.stringify(tree, null, 2);
  userContent += `\n\n--- Project file tree ---\n${fileTreeText}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";

  const filesChanged: { path: string; content: string }[] = [];
  const fileRegex = /<<<FILE:(.+?)>>>\n([\s\S]*?)\n<<<ENDFILE>>>/g;
  let match;
  while ((match = fileRegex.exec(text)) !== null) {
    const filePath = match[1].trim();
    const fileContent = match[2];
    filesChanged.push({ path: filePath, content: fileContent });
  }

  let diff: string | null = null;
  if (filesChanged.length > 0) {
    const parts: string[] = [];
    for (const f of filesChanged) {
      const fullPath = path.join(localPath, f.path);
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

export function applyChanges(
  localPath: string,
  files: { path: string; content: string }[]
): void {
  for (const f of files) {
    writeFileContent(localPath, f.path, f.content);
  }
}
