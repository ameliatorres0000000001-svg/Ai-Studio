import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, Effort, Provider, ProviderResult, ResolvedModel, SendOptions } from "./types";

// SERVER-ONLY. Anthropic Messages API format (direct, gateway, or any compatible endpoint).

const MAX_TOKENS = Number(process.env.AI_MAX_TOKENS || process.env.ANTHROPIC_MAX_TOKENS) || 8192;

export const anthropicProvider: Provider = {
  async send(messages: ChatMessage[], model: ResolvedModel, effort?: Effort, opts?: SendOptions): Promise<ProviderResult> {
    const client = new Anthropic({
      apiKey: model.apiKey,
      ...(model.baseUrl ? { baseURL: model.baseUrl } : {}),
    });

    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const turns = messages
      .filter((m): m is ChatMessage & { role: "user" | "assistant" } => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const response = await client.messages.create({
      model: model.config.upstreamModel,
      max_tokens: opts?.maxTokens ?? MAX_TOKENS,
      ...(system ? { system } : {}),
      messages: turns,
      ...(effort && model.config.effortSupport ? { output_config: { effort } } : {}),
    });

    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    if (response.stop_reason === "refusal" && !text) {
      throw new Error("The model declined this request");
    }

    return {
      text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  },
};
