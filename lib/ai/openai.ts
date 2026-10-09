import type { ChatMessage, Effort, Provider, ProviderResult, ResolvedModel } from "./types";

// SERVER-ONLY. OpenAI chat-completions format, via plain fetch (no extra dependency).
// The base URL env var must include any version prefix, e.g. https://host/v1

const MAX_TOKENS = Number(process.env.AI_MAX_TOKENS) || 8192;
const TIMEOUT_MS = 120_000;

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

export const openaiProvider: Provider = {
  async send(messages: ChatMessage[], model: ResolvedModel, effort?: Effort): Promise<ProviderResult> {
    if (!model.baseUrl) {
      throw new Error("OpenAI-format route requires a base URL env var");
    }
    const url = `${model.baseUrl.replace(/\/+$/, "")}/chat/completions`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${model.apiKey}`,
        },
        body: JSON.stringify({
          model: model.config.upstreamModel,
          messages,
          max_completion_tokens: MAX_TOKENS,
          ...(effort && model.config.effortSupport ? { reasoning_effort: effort } : {}),
        }),
        signal: controller.signal,
        cache: "no-store",
      });

      let body: ChatCompletionResponse | null = null;
      try {
        body = (await res.json()) as ChatCompletionResponse;
      } catch {
        /* non-JSON body */
      }
      if (!res.ok) {
        throw new Error(body?.error?.message || `Model API error (${res.status})`);
      }

      return {
        text: body?.choices?.[0]?.message?.content ?? "",
        usage: {
          inputTokens: body?.usage?.prompt_tokens ?? 0,
          outputTokens: body?.usage?.completion_tokens ?? 0,
        },
      };
    } catch (e) {
      if (controller.signal.aborted) throw new Error("Model API request timed out");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  },
};
