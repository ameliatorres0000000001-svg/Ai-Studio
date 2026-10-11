import Anthropic from "@anthropic-ai/sdk";
import { listAvailableModels, resolveModel } from "@/lib/ai";
import type { ResolvedModel } from "@/lib/ai";
import { REQUIREMENTS_SYSTEM_PROMPT, SUBMIT_BOT_SPEC_TOOL } from "./prompts";
import { isBotSpec, type BotBuilderMessage, type BotBuilderTurnResult } from "./types";

// SERVER-ONLY. Uses the repo's model gateway (config/models.json): the route's
// key and base URL come from the resolved model, never from the browser.
// Quota + usage logging happen in the API route, not here. Tool use needs the
// Anthropic messages format, so only anthropic-format routes qualify.
const MAX_TOKENS = 2048;

/** First available code-purpose model on an Anthropic-format route, or null. */
export function resolveBotBuilderModel(): ResolvedModel | null {
  const cands = listAvailableModels().filter((m) => m.purpose.includes("code"));
  for (const c of cands) {
    const m = resolveModel(c.id);
    if (m && m.route.format === "anthropic") return m;
  }
  return null;
}

/**
 * Runs one turn of the no-code bot-building conversation.
 * `history` is the prior turns (user/assistant text only); `userMessage` is the
 * newest message to append before calling the model.
 */
export async function runBotBuilderTurn(
  model: ResolvedModel,
  history: BotBuilderMessage[],
  userMessage: string
): Promise<BotBuilderTurnResult> {
  const client = new Anthropic({
    apiKey: model.apiKey,
    ...(model.baseUrl ? { baseURL: model.baseUrl } : {}),
  });

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content }) as Anthropic.MessageParam),
    { role: "user", content: userMessage },
  ];

  const response = await client.messages.create({
    model: model.config.upstreamModel,
    max_tokens: MAX_TOKENS,
    system: REQUIREMENTS_SYSTEM_PROMPT,
    tools: [SUBMIT_BOT_SPEC_TOOL],
    messages,
  });

  let reply = "";
  let spec: BotBuilderTurnResult["spec"];

  for (const block of response.content) {
    if (block.type === "text") {
      reply += block.text;
    } else if (block.type === "tool_use" && block.name === "submit_bot_spec") {
      if (isBotSpec(block.input)) {
        spec = block.input;
      }
    }
  }

  const usage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };

  if (spec) {
    return {
      reply: reply || "បានទទួលព័ត៌មានគ្រប់គ្រាន់ហើយ! កំពុងរៀបចំ bot របស់អ្នក...",
      done: true,
      spec,
      usage,
    };
  }

  return { reply: reply || "តើអ្នកអាចប្រាប់បន្ថែមបន្តិចទៀតបានទេ?", done: false, usage };
}
