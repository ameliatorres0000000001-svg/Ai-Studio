// Setup check: prints ONLY OK/FAIL lines, never secret values.
// Run: npm run check:setup
// Reads .env.local + .env.example (names only), probes Supabase tables,
// GitHub /user (login only), model route envs, Telegram token presence.
// Does NOT call any paid model.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

let failures = 0;
function ok(label) {
  console.log(`OK ${label}`);
}
function fail(label, hint = "") {
  failures++;
  console.log(`FAIL ${label}${hint ? ` (${hint})` : ""}`);
}

// Tiny .env parser: presence only, values never leave this process.
function parseEnvFile(file) {
  const out = {};
  let text = "";
  try {
    text = fs.readFileSync(file, "utf-8");
  } catch {
    return out;
  }
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function expectedNames(file) {
  const names = [];
  let text = "";
  try {
    text = fs.readFileSync(file, "utf-8");
  } catch {
    return names;
  }
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(=.*)?$/);
    if (m && !names.includes(m[1])) names.push(m[1]);
  }
  return names;
}

const local = parseEnvFile(path.join(root, ".env.local"));
const set = (n) => ((local[n] ?? "").trim() !== "");

// 1. Every env NAME from .env.example: set or missing.
const expected = expectedNames(path.join(root, ".env.example"));
if (expected.length === 0) fail("ENV list", ".env.example unreadable");
for (const n of expected) {
  if (set(n)) ok(`ENV ${n}`);
  else fail(`ENV ${n}`, "missing");
}

// 2. Supabase: server query works; tables exist or missing (+ creating migration).
const TABLES = [
  ["github_connections", "20261006160421_create_ai_studio_schema.sql"],
  ["workspaces", "20261006160421_create_ai_studio_schema.sql"],
  ["activities", "20261006160421_create_ai_studio_schema.sql"],
  ["chat_messages", "20261006160421_create_ai_studio_schema.sql"],
  ["claude_sessions", "20261006165614_upgrade_to_multi_tenant_with_auth.sql"],
  ["deployments", "20261006165614_upgrade_to_multi_tenant_with_auth.sql"],
  ["telegram_connections", "20261007110000_telegram_connector.sql"],
  ["usage_events", "20261009090000_usage_events.sql"],
  ["plans", "20261010000000_plans.sql"],
  ["user_plans", "20261010000000_plans.sql"],
  ["waitlist", "20261010000000_plans.sql"],
  ["payment_submissions", "20261010000000_plans.sql"],
];

const supaUrl = (local.NEXT_PUBLIC_SUPABASE_URL || local.SUPABASE_URL || "").trim().replace(/\/$/, "");
const serviceKey = (local.SUPABASE_SERVICE_ROLE_KEY || "").trim();
let supaReachable = false;
if (!supaUrl || !serviceKey) {
  fail("SUPABASE query", "missing");
  for (const [t, mig] of TABLES) fail(`SUPABASE table ${t}`, `unknown; migration: ${mig}`);
} else {
  for (const [t, mig] of TABLES) {
    try {
      const res = await fetch(`${supaUrl}/rest/v1/${t}?select=id&limit=1`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      supaReachable = true;
      if (res.ok) ok(`SUPABASE table ${t}`);
      else if (res.status === 404) fail(`SUPABASE table ${t}`, `missing; migration: ${mig}`);
      else if (res.status === 401 || res.status === 403) fail(`SUPABASE table ${t}`, "denied");
      else fail(`SUPABASE table ${t}`, `http ${res.status}`);
    } catch {
      fail(`SUPABASE table ${t}`, `unreachable; migration: ${mig}`);
    }
  }
  if (supaReachable) ok("SUPABASE query");
  else fail("SUPABASE query", "unreachable");
}

// 3. GitHub: GET /user, print only the login and OK.
const ghTok = (local.GITHUB_ACCESS_TOKEN || "").trim();
if (!ghTok) {
  fail("GITHUB", "GITHUB_ACCESS_TOKEN missing");
} else {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${ghTok}`, "User-Agent": "check-setup" },
    });
    if (res.ok) {
      const d = await res.json();
      ok(`GITHUB user ${d.login}`);
    } else {
      fail("GITHUB", `http ${res.status}`);
    }
  } catch {
    fail("GITHUB", "unreachable");
  }
}

// 4. Models: per route, which env names are missing. No model calls.
try {
  const modelsJson = JSON.parse(fs.readFileSync(path.join(root, "config/models.json"), "utf-8"));
  for (const [name, r] of Object.entries(modelsJson.routes)) {
    const missing = [];
    if (!set(r.keyEnv)) missing.push(r.keyEnv);
    if (r.baseUrlEnv && !set(r.baseUrlEnv)) missing.push(r.baseUrlEnv);
    if (missing.length === 0) ok(`MODELS route ${name}`);
    else fail(`MODELS route ${name}`, `missing: ${missing.join(", ")}`);
  }
} catch {
  fail("MODELS routes", "config/models.json unreadable");
}

// 5. Telegram: token set or not. No network call.
if (set("TELEGRAM_BOT_TOKEN")) ok("TELEGRAM");
else fail("TELEGRAM", "TELEGRAM_BOT_TOKEN missing");

process.exit(failures ? 1 : 0);
