// SERVER-ONLY. Shared types for the model-routing layer.

export type Purpose = "code" | "research";
export type Tier = "free" | "pro" | "premium";
export type Effort = "low" | "medium" | "high";
export type Format = "anthropic" | "openai";

export const PURPOSES: readonly Purpose[] = ["code", "research"];
export const EFFORTS: readonly Effort[] = ["low", "medium", "high"];

export interface RouteConfig {
  format: Format;
  /** Name of the env var holding the base URL. Omit to use the provider's default endpoint. */
  baseUrlEnv?: string;
  /** Name of the env var holding the API key. */
  keyEnv: string;
}

export interface ModelConfig {
  id: string;
  label: string;
  /** Modes this model may be used for. */
  purpose: Purpose[];
  tier: Tier;
  route: string;
  /** Upstream model id. Empty (or TODO*) hides the model until it is configured. */
  upstreamModel: string;
  /** Display group in the model picker. */
  provider: string;
  /** File name under /icon/. A missing file falls back to initials. */
  icon: string;
  effortSupport: boolean;
}

export interface ModelsConfig {
  version: number;
  routes: Record<string, RouteConfig>;
  models: ModelConfig[];
}

/** Safe-to-expose model description (no route, no env names, no secrets). */
export interface PublicModel {
  id: string;
  label: string;
  purpose: Purpose[];
  tier: Tier;
  provider: string;
  icon: string;
  effortSupport: boolean;
}

/** A model plus its route credentials, read from env on the server. Never serialize this. */
export interface ResolvedModel {
  config: ModelConfig;
  routeName: string;
  route: RouteConfig;
  baseUrl?: string;
  apiKey: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface ProviderResult {
  text: string;
  /** Filled by the orchestration layer in "code" mode, not by providers. */
  filesChanged?: { path: string; content: string }[];
  usage: Usage;
}

export interface SendOptions {
  /** Overrides the default max tokens (used by the admin model test). */
  maxTokens?: number;
}

export interface Provider {
  send(messages: ChatMessage[], model: ResolvedModel, effort?: Effort, opts?: SendOptions): Promise<ProviderResult>;
}
