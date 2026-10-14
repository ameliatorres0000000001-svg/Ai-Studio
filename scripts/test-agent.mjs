// Phase 4 acceptance test: runs runAgent on a temp git repo and prints events.
// Usage: node --env-file=.env.local scripts/test-agent.mjs
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execFileSync } from "child_process";

const tmp = mkdtempSync(join(tmpdir(), "agent-test-"));
writeFileSync(join(tmp, "index.js"), 'function foo() { return 1; }\nmodule.exports = { foo };\n');
writeFileSync(join(tmp, "helper.js"), 'const { foo } = require("./index");\nconsole.log(foo());\n');
execFileSync("git", ["init", "-b", "main"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "init"], { cwd: tmp, stdio: "ignore" });

// Build the runAgent call. We import the TS source through the workspace's own
// module resolution — the script runs with the app's tsconfig aliases resolved
// by the dev environment (tsx/ts-node not required: Next.js bundles this file).
const { runAgent } = await import("../lib/agent/run.ts").catch(() =>
  import("../lib/agent/run.js")
).catch(async () => {
  // Fallback: compile-free path via tsx if present
  const { createRequire } = await import("module");
  const req = createRequire(import.meta.url);
  return req("../lib/agent/run.ts");
});

const events = [];
const fakeWorkspace = { id: "11111111-2222-3333-4444-555555555555", user_id: "test-user", repo_full_name: "test/agent" };
const fakeModel = {
  config: { id: "test", label: "test", upstreamModel: process.env.AGENT_TEST_MODEL || "claude-haiku-4-5", effortSupport: false, purpose: ["code"], tier: "free", route: "gateway", provider: "test", icon: "" },
  routeName: "gateway",
  route: { format: "anthropic", keyEnv: "AI_GATEWAY_API_KEY", baseUrlEnv: "AI_GATEWAY_BASE_URL" },
  apiKey: process.env.AI_GATEWAY_API_KEY || "",
  baseUrl: process.env.AI_GATEWAY_BASE_URL,
};

// Point WORKSPACE_ROOT at the temp repo's parent so getWorkspacePath resolves it.
process.env.WORKSPACE_ROOT = join(tmp, "..");

// Copy the repo into the workspace layout expected by runAgent.
const wsRoot = join(tmp, "..", "test-ws");
mkdirSync(join(wsRoot, "test-user", fakeWorkspace.id), { recursive: true });
execFileSync("cp", ["-r", tmp + "/.", join(wsRoot, "test-user", fakeWorkspace.id)], { stdio: "ignore" });
process.env.WORKSPACE_ROOT = wsRoot;

await runAgent({
  userId: "test-user",
  workspace: fakeWorkspace,
  model: fakeModel,
  mode: "code",
  prompt: "Rename function foo to bar everywhere in this repo, including the call in helper.js",
  onEvent: (e) => {
    events.push(e);
    const short = JSON.stringify(e).slice(0, 300);
    console.log("EVENT", short);
  },
});

const renamed = readFileSync(join(wsRoot, "test-user", fakeWorkspace.id, "index.js"), "utf-8").includes("function bar");
const helperRenamed = readFileSync(join(wsRoot, "test-user", fakeWorkspace.id, "helper.js"), "utf-8").includes("bar");
const hasDone = events.some((e) => e.type === "done");

console.log(`rename-index: ${renamed ? "PASS" : "FAIL"}`);
console.log(`rename-helper: ${helperRenamed ? "PASS" : "FAIL"}`);
console.log(`done-event: ${hasDone ? "PASS" : "FAIL"}`);
console.log(`events: ${events.length}`);
