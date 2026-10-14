// Phase 0 gateway capability test. Run: node --env-file=.env.local scripts/test-gateway.mjs
import Anthropic from "@anthropic-ai/sdk";

const key = process.env.AI_GATEWAY_API_KEY;
const baseURL = process.env.AI_GATEWAY_BASE_URL;
if (!key || !baseURL) {
  console.error("FAIL setup: AI_GATEWAY_API_KEY or AI_GATEWAY_BASE_URL not set");
  process.exit(1);
}

const client = new Anthropic({ apiKey: key, baseURL });
const MODEL = "claude-haiku-4-5";

function usage(u) {
  if (!u) return "usage: n/a";
  return `usage: in=${u.input_tokens ?? 0} out=${u.output_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0} cache_read=${u.cache_read_input_tokens ?? 0}`;
}

// a) tool use
try {
  const tools = [{
    name: "get_time",
    description: "Get the current time.",
    input_schema: { type: "object", properties: {}, required: [] },
  }];
  const r1 = await client.messages.create({
    model: MODEL, max_tokens: 1024, tools,
    messages: [{ role: "user", content: "What time is it? Use the tool." }],
  });
  const tu = r1.content.find((b) => b.type === "tool_use");
  console.log(`a1 tool-call: ${r1.stop_reason === "tool_use" && tu ? "PASS" : "FAIL"} (${usage(r1.usage)})`);
  const r2 = await client.messages.create({
    model: MODEL, max_tokens: 1024, tools,
    messages: [
      { role: "user", content: "What time is it? Use the tool." },
      { role: "assistant", content: r1.content },
      { role: "user", content: [{ type: "tool_result", tool_use_id: tu.id, content: "12:00:00 UTC" }] },
    ],
  });
  const txt = r2.content.filter((b) => b.type === "text").map((b) => b.text).join(" ");
  console.log(`a2 tool-result: ${txt.trim().length > 0 ? "PASS" : "FAIL"} (${usage(r2.usage)})`);
} catch (e) {
  console.log(`a tool-use: FAIL (${e.status ?? ""} ${e.message})`);
}

// b) streaming
try {
  const stream = client.messages.stream({
    model: MODEL, max_tokens: 256,
    messages: [{ role: "user", content: "Count from 1 to 20, one per line." }],
  });
  let deltas = 0;
  stream.on("text", () => deltas++);
  const final = await stream.finalMessage();
  console.log(`b streaming: ${deltas > 1 ? "PASS" : "FAIL"} deltas=${deltas} (${usage(final.usage)})`);
} catch (e) {
  console.log(`b streaming: FAIL (${e.status ?? ""} ${e.message})`);
}

// c) prompt caching
try {
  const sysBlock = "You are a helpful assistant.\n" + "x".repeat(4800); // ~1200 tokens
  const system = [{ type: "text", text: sysBlock, cache_control: { type: "ephemeral" } }];
  const c1 = await client.messages.create({
    model: MODEL, max_tokens: 32, system,
    messages: [{ role: "user", content: "Say ok" }],
  });
  console.log(`c1 cache-write: (${usage(c1.usage)})`);
  const c2 = await client.messages.create({
    model: MODEL, max_tokens: 32, system,
    messages: [{ role: "user", content: "Say ok" }],
  });
  const hit = (c2.usage?.cache_read_input_tokens ?? 0) > 0;
  console.log(`c2 cache-read: ${hit ? "PASS" : "FAIL"} (${usage(c2.usage)})`);
} catch (e) {
  console.log(`c caching: FAIL (${e.status ?? ""} ${e.message})`);
}
