// SERVER-ONLY. Shared multi-tenant data for generated bots (ONE Supabase
// project): tenant rows are keyed by bot_id and protected by RLS on the JWT
// `bot_id` claim (migration 20261016000000_builder_pipeline.sql).

import { supabaseAdmin } from "@/lib/supabase-server";
import { signJwtHs256 } from "@/lib/crypto";
import { StepError } from "./pipeline";
import type { BuilderDeps } from "./types";

const DATA_JWT_TTL_S = 365 * 24 * 3600;

export const dataAdapter: BuilderDeps["data"] = {
  async provision(botId, products) {
    // Idempotent: replace this bot's catalogue snapshot.
    const del = await supabaseAdmin.from("bot_products").delete().eq("bot_id", botId);
    if (del.error) throw new Error("Could not reset the product catalogue");
    if (!products.length) return;
    const rows = products.slice(0, 100).map((p, i) => ({ bot_id: botId, position: i, name: p.name, price: p.price, currency: p.currency, description: p.description ?? null }));
    const ins = await supabaseAdmin.from("bot_products").insert(rows);
    if (ins.error) throw new Error("Could not seed the product catalogue");
  },

  runtimeEnv(botId) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!url || !anon || !secret) throw new StepError("Shared data store is not configured (SUPABASE_JWT_SECRET / anon key)", false);
    const now = Math.floor(Date.now() / 1000);
    // role must be an existing Postgres role; RLS reads the bot_id claim.
    const jwt = signJwtHs256({ role: "authenticated", aud: "authenticated", iss: "telescripts", bot_id: botId, iat: now, exp: now + DATA_JWT_TTL_S }, secret);
    return { SUPABASE_URL: url, SUPABASE_ANON_KEY: anon, BOT_DATA_JWT: jwt };
  },
};
