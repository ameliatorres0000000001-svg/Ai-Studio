import modelsJson from "@/config/models.json";
import type {
  ModelConfig,
  ModelsConfig,
  Purpose,
  PublicModel,
  ResolvedModel,
  RouteConfig,
} from "./types";

// SERVER-ONLY. Reads route credentials from env by the names listed in config/models.json.

const config = modelsJson as unknown as ModelsConfig;

for (const m of config.models) {
  if (!config.routes[m.route]) {
    throw new Error(`config/models.json: model "${m.id}" uses unknown route "${m.route}"`);
  }
  if (!Array.isArray(m.purpose)) {
    throw new Error(`config/models.json: model "${m.id}" purpose must be an array`);
  }
}

function envValue(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

function isRouteConfigured(route: RouteConfig): boolean {
  if (!envValue(route.keyEnv)) return false;
  if (route.baseUrlEnv && !envValue(route.baseUrlEnv)) return false;
  return true;
}

/** Models with an empty (or TODO placeholder) upstream id are never offered. */
function isModelAvailable(m: ModelConfig): boolean {
  if (!m.upstreamModel || m.upstreamModel.startsWith("TODO")) return false;
  return isRouteConfigured(config.routes[m.route]);
}

function toPublic(m: ModelConfig): PublicModel {
  return {
    id: m.id,
    label: m.label,
    purpose: m.purpose,
    tier: m.tier,
    provider: m.provider,
    icon: m.icon,
    effortSupport: m.effortSupport,
  };
}

export function listAvailableModels(): PublicModel[] {
  return config.models.filter(isModelAvailable).map(toPublic);
}

/** Returns null if the model id is unknown or not currently available. */
export function resolveModel(modelId: unknown): ResolvedModel | null {
  if (typeof modelId !== "string") return null;
  const m = config.models.find((x) => x.id === modelId);
  if (!m || !isModelAvailable(m)) return null;
  const route = config.routes[m.route];
  return {
    config: m,
    routeName: m.route,
    route,
    baseUrl: envValue(route.baseUrlEnv),
    apiKey: envValue(route.keyEnv)!,
  };
}

export function isPurpose(v: unknown): v is Purpose {
  return v === "code" || v === "research";
}
