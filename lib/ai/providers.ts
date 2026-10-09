import { anthropicProvider } from "./anthropic";
import { openaiProvider } from "./openai";
import type { Format, Provider } from "./types";

export function providerFor(format: Format): Provider {
  return format === "openai" ? openaiProvider : anthropicProvider;
}
