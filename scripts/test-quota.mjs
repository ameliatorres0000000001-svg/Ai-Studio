// Quota proof: a free user gets 429 after the limit and cannot use premium
// models. The model call itself is mocked — only the entitlement gate is real.
//
// Run: node scripts/test-quota.mjs   (exit 0 = all checks pass)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const require = createRequire(import.meta.url);

const modelsJson = JSON.parse(fs.readFileSync(path.join(root, "config/models.json"), "utf-8"));

// Compile the real lib/entitlements.ts (pure part) and load it with a shimmed
// require so "@/config/models.json" resolves to the file above. liveDeps is
// never called because every check passes explicit mock deps.
const src = fs.readFileSync(path.join(root, "lib/entitlements.ts"), "utf-8");
const { outputText } = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const module = { exports: {} };
const shimRequire = (id) => {
  if (id === "@/config/models.json") return modelsJson;
  return require(id);
};
new Function("require", "module", "exports", "process", outputText)(
  shimRequire,
  module,
  module.exports,
  process
);
const { evaluateEntitlement } = module.exports;

const FREE = { id: "free", dailyLimit: 5, tiers: ["free"], expired: false };
const PRO = { id: "pro", dailyLimit: 100, tiers: ["free", "pro"], expired: false };
const PREMIUM = { id: "premium", dailyLimit: 500, tiers: ["free", "pro", "premium"], expired: false };

// Mock of the provider call in the chat route: the gate runs first, exactly
// like app/api/claude/chat/route.ts (check before the call, 429 on denial).
async function mockChatCall({ userId, modelId, plan, usedToday, isAdmin }) {
  const tier = modelsJson.models.find((m) => m.id === modelId)?.tier ?? null;
  const gate = evaluateEntitlement({ plan, usedToday, tier, isAdmin });
  if (!gate.allowed) {
    const err = new Error(gate.messageEn);
    err.status = 429;
    throw err;
  }
  return { ok: true }; // the real provider would run here
}

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failures++;
}

const freeTierModel = modelsJson.models.find((m) => m.tier === "free").id;
const premiumTierModel = modelsJson.models.find((m) => m.tier === "premium").id;

// 1. Free user under the limit may call a free model.
await mockChatCall({ userId: "u1", modelId: freeTierModel, plan: FREE, usedToday: 4, isAdmin: false })
  .then((r) => check("free user under limit: allowed", r.ok))
  .catch(() => check("free user under limit: allowed", false));

// 2. Free user at the limit gets 429.
await mockChatCall({ userId: "u1", modelId: freeTierModel, plan: FREE, usedToday: 5, isAdmin: false })
  .then(() => check("free user at limit: 429", false))
  .catch((e) => check("free user at limit: 429", e.status === 429));

// 3. Free user cannot use a premium model even with quota left.
await mockChatCall({ userId: "u1", modelId: premiumTierModel, plan: FREE, usedToday: 0, isAdmin: false })
  .then(() => check("free user on premium model: 429 tier lock", false))
  .catch((e) => check("free user on premium model: 429 tier lock", e.status === 429));

// 4. Pro user cannot use a premium model either.
await mockChatCall({ userId: "u2", modelId: premiumTierModel, plan: PRO, usedToday: 0, isAdmin: false })
  .then(() => check("pro user on premium model: 429 tier lock", false))
  .catch((e) => check("pro user on premium model: 429 tier lock", e.status === 429));

// 5. Premium user may use a premium model.
await mockChatCall({ userId: "u3", modelId: premiumTierModel, plan: PREMIUM, usedToday: 499, isAdmin: false })
  .then((r) => check("premium user on premium model: allowed", r.ok))
  .catch(() => check("premium user on premium model: allowed", false));

// 6. Admin bypasses quota and tier.
await mockChatCall({ userId: "admin", modelId: premiumTierModel, plan: FREE, usedToday: 9999, isAdmin: true })
  .then((r) => check("admin unlimited: allowed", r.ok))
  .catch(() => check("admin unlimited: allowed", false));

// 7. Unknown model id is denied, never passed to a provider.
await mockChatCall({ userId: "u1", modelId: "nope", plan: FREE, usedToday: 0, isAdmin: false })
  .then(() => check("unknown model: denied", false))
  .catch((e) => check("unknown model: denied", e.status === 429));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll quota checks passed.");
