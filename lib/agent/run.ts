// SERVER-ONLY. Wraps the Claude Agent SDK query() for CodingStudio workspaces:
// fixed tool surface, an in-process MCP `run_command` (validated by
// lib/workspace.ts), PreToolUse path guard, minimal env, and a small event
// schema streamed to the API route — never raw tool output to the browser.

import fs from "fs";
import os from "os";
import path from "path";
import { query, tool, createSdkMcpServer, type HookJSONOutput, type HookInput } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { getWorkspacePath, resolveInside, redactSecrets, runCommand } from "@/lib/workspace";
import type { ResolvedModel } from "@/lib/ai";
import type { Workspace } from "@/lib/types";

const MAX_TOOL_RESULT_CHARS = 2000;
const MAX_COMMAND_OUTPUT = 20_000;
const COMMAND_TIMEOUT_MS = 60_000;
const MAX_CLAUDE_MD_CHARS = 8000;
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || path.join(process.cwd(), ".workspaces");

const AGENT_APPEND_PROMPT = `
You are running inside CodingStudio, a hosted workspace. Strict rules:
- Work only inside the current working directory. Never read, write or touch any path outside it.
- Never read, print, edit or commit .env, .env.*, .git/** or node_modules/** — they are denied at the hook layer.
- Never reveal secrets (API keys, tokens, passwords) in output or files.
- Use the run_command tool for terminal commands; there is no Bash tool.
- Keep text between tool calls brief — the user sees every message.
- At the end, summarize what changed (files edited, why, anything that failed).
- Do not create commits, tags, branches or push — the host manages git.
`;

export type AgentEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; id: string; ok: boolean; summary: string }
  | { type: "todo"; items: { content: string; status: string }[] }
  | { type: "session"; sessionId: string }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "done"; stopReason: string | null; isError: boolean; errors: string[] }
  | { type: "error"; message: string };

export interface RunAgentOptions {
  userId: string;
  workspace: Workspace;
  model: ResolvedModel;
  mode: "code" | "plan";
  prompt: string;
  resumeSessionId?: string;
  signal?: AbortSignal;
  onEvent: (event: AgentEvent) => void;
}

// One active run per workspace (in-memory). A second request gets a 409 error.
const activeRuns = new Map<string, AbortController>();

export class AgentBusyError extends Error {
  constructor() {
    super("Agent is already running");
    this.name = "AgentBusyError";
  }
}

const DENIED_PATTERNS: { test: (p: string) => boolean; reason: string }[] = [
  { test: (p) => /(^|\/)\.env($|\.|\/)/.test(p) || p === ".env" || p.startsWith(".env"), reason: "Access to .env files is not allowed" },
  { test: (p) => p === ".git" || p.startsWith(".git/") || p.includes("/.git/"), reason: "Access to .git internals is not allowed" },
  { test: (p) => p === "node_modules" || p.startsWith("node_modules/") || p.includes("/node_modules/"), reason: "Access to node_modules is not allowed" },
];

function denyReason(toolName: string, input: Record<string, unknown>): string | null {
  const paths: string[] = [];
  for (const key of ["file_path", "path", "pattern", "notebook_path"]) {
    const v = input[key];
    if (typeof v === "string" && v) paths.push(v);
  }
  if (toolName === "mcp__workspace__run_command") {
    const cmd = String(input.command || "");
    if (/\.env|\.git(\/|\s|$)|node_modules/.test(cmd)) {
      return "The command touches .env, .git, or node_modules — not allowed";
    }
    return null;
  }
  for (const p of paths) {
    for (const rule of DENIED_PATTERNS) {
      if (rule.test(p)) return rule.reason;
    }
  }
  return null;
}

function summarizeInput(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input || {})) {
    if (typeof v === "string") out[k] = v.length > 200 ? v.slice(0, 200) + "…" : v;
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else out[k] = typeof v;
  }
  return out;
}

function toolResultSummary(result: unknown): string {
  if (result === undefined || result === null) return "";
  let text: string;
  if (typeof result === "string") text = result;
  else {
    try {
      text = JSON.stringify(result);
    } catch {
      text = String(result);
    }
  }
  text = redactSecrets(text);
  if (text.length > MAX_TOOL_RESULT_CHARS) text = text.slice(0, MAX_TOOL_RESULT_CHARS) + "… [truncated]";
  return text;
}

function readRepoClaudeMd(cwd: string): string {
  try {
    const p = path.join(cwd, "CLAUDE.md");
    if (!fs.existsSync(p)) return "";
    return fs.readFileSync(p, "utf-8").slice(0, MAX_CLAUDE_MD_CHARS);
  } catch {
    return "";
  }
}

export async function runAgent(opts: RunAgentOptions): Promise<void> {
  const { userId, workspace, model, mode, prompt, resumeSessionId, signal, onEvent } = opts;

  if (model.route.format !== "anthropic") {
    throw new Error("Agent mode needs a Claude model");
  }

  if (activeRuns.has(workspace.id)) throw new AgentBusyError();
  const controller = new AbortController();
  activeRuns.set(workspace.id, controller);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  const cwd = getWorkspacePath(workspace.id, userId);
  if (!fs.existsSync(path.join(cwd, ".git"))) {
    activeRuns.delete(workspace.id);
    throw new Error("Workspace files are not present — sync the repository first");
  }

  const homeDir = path.join(WORKSPACE_ROOT, userId, ".home");
  fs.mkdirSync(homeDir, { recursive: true });

  const env = gatewayEnv(homeDir);
  env.CLAUDE_AGENT_SDK_CLIENT_APP = "coding-studio/phase4";

  const repoClaudeMd = readRepoClaudeMd(cwd);

  const runCommandTool = tool(
    "run_command",
    "Run an allowlisted command inside the workspace (npm, node, tsc, cat, ls, git status/diff/log/branch/show). No shell chaining, sudo, rm -rf, or eval.",
    { command: z.string().describe("The command line to execute") },
    async (args) => {
      try {
        const result = await runCommand(cwd, args.command, COMMAND_TIMEOUT_MS);
        let text = `$ ${args.command}\n`;
        if (result.stdout) text += result.stdout;
        if (result.stderr) text += (result.stdout ? "\n" : "") + result.stderr;
        text += `\n(exit ${result.exitCode})`;
        if (text.length > MAX_COMMAND_OUTPUT) {
          text = text.slice(0, MAX_COMMAND_OUTPUT) + "\n… [output truncated]";
        }
        return { content: [{ type: "text" as const, text: redactSecrets(text) }] };
      } catch (e: any) {
        return {
          content: [{ type: "text" as const, text: redactSecrets(e?.message || "command failed") }],
          isError: true,
        };
      }
    }
  );

  const mcpServers = {
    workspace: createSdkMcpServer({ name: "workspace", tools: [runCommandTool], timeout: COMMAND_TIMEOUT_MS + 5000 }),
  };

  const hooks = {
    PreToolUse: [
      {
        hooks: [
          async (input: HookInput): Promise<HookJSONOutput> => {
            if (input.hook_event_name !== "PreToolUse") return { continue: true } as HookJSONOutput;
            const toolName = String(input.tool_name || "");
            const toolInput = (input.tool_input || {}) as Record<string, unknown>;
            const reason = denyReason(toolName, toolInput);
            if (reason) {
              return {
                hookEventName: "PreToolUse",
                permissionDecision: "deny",
                permissionDecisionReason: reason,
              } as HookJSONOutput;
            }
            // Path containment: any file_path/path/pattern must resolve inside cwd.
            for (const key of ["file_path", "path", "notebook_path"]) {
              const p = toolInput[key];
              if (typeof p !== "string" || !p) continue;
              const clean = p.startsWith("~") ? p.slice(1) : p;
              const rel = path.isAbsolute(clean) ? path.relative(cwd, clean) : clean;
              try {
                resolveInside(cwd, rel);
              } catch {
                return {
                  hookEventName: "PreToolUse",
                  permissionDecision: "deny",
                  permissionDecisionReason: `Path "${p}" is outside the workspace`,
                } as HookJSONOutput;
              }
            }
            return { continue: true } as HookJSONOutput;
          },
        ],
      },
    ],
  };

  try {
    const stream = query({
      prompt,
      options: {
        cwd,
        model: model.config.upstreamModel,
        tools: ["Read", "Edit", "Write", "Glob", "Grep", "TodoWrite"],
        allowedTools: ["mcp__workspace__run_command"],
        mcpServers,
        strictMcpConfig: true,
        settingSources: [],
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: AGENT_APPEND_PROMPT + (repoClaudeMd ? `\n\n--- Repository CLAUDE.md ---\n${repoClaudeMd}` : ""),
        },
        permissionMode: mode === "plan" ? "plan" : "acceptEdits",
        permissionPrompts: "none",
        hooks,
        env,
        includePartialMessages: true,
        abortController: controller,
        resume: resumeSessionId,
        maxTurns: 30,
        ...(model.config.effortSupport ? { effort: "high" as const } : {}),
      },
    });

    await pipeEvents(stream, controller, onEvent);
  } catch (e: any) {
    if (controller.signal.aborted || signal?.aborted) {
      onEvent({ type: "done", stopReason: "aborted", isError: true, errors: ["Run aborted"] });
    } else {
      onEvent({ type: "error", message: redactSecrets(e?.message || "Agent run failed") });
    }
  } finally {
    if (signal) signal.removeEventListener("abort", onAbort);
    activeRuns.delete(workspace.id);
  }
}

/** Maps the Agent SDK message stream onto AgentEvent (shared by workspace and platform agents). */
async function pipeEvents(stream: AsyncIterable<any>, controller: AbortController, onEvent: (event: AgentEvent) => void): Promise<void> {
  const toolIds = new Map<string, string>();
  let emittedSession = false;

  for await (const message of stream) {
    if (controller.signal.aborted) break;

    if (message.type === "system" && (message as { subtype?: string }).subtype === "init") {
      if (!emittedSession) {
        emittedSession = true;
        onEvent({ type: "session", sessionId: message.session_id });
      }
      continue;
    }

    if (message.type === "stream_event") {
      const ev = (message as { event?: { type?: string; delta?: { type?: string; text?: string } } }).event;
      if (ev?.type === "content_block_delta" && ev.delta?.type === "text_delta" && ev.delta.text) {
        onEvent({ type: "text_delta", text: ev.delta.text });
      }
      continue;
    }

    if (message.type === "assistant") {
      const content = (message as { message?: { content?: unknown[] } }).message?.content;
      if (Array.isArray(content)) {
        for (const block of content as { type?: string; id?: string; name?: string; input?: unknown; text?: string }[]) {
          if (block.type === "tool_use" && block.id) {
            toolIds.set(block.id, block.name || "tool");
            onEvent({
              type: "tool_use",
              id: block.id,
              name: block.name || "tool",
              input: summarizeInput((block.input || {}) as Record<string, unknown>),
            });
            if (block.name === "TodoWrite" && block.input && typeof block.input === "object") {
              const todos = (block.input as { todos?: { content?: string; status?: string }[] }).todos;
              if (Array.isArray(todos)) {
                onEvent({
                  type: "todo",
                  items: todos.map((t) => ({ content: String(t.content || ""), status: String(t.status || "") })),
                });
              }
            }
          }
        }
      }
      continue;
    }

    if (message.type === "user") {
      const content = (message as { message?: { content?: unknown } }).message?.content;
      if (Array.isArray(content)) {
        for (const block of content as { type?: string; tool_use_id?: string; is_error?: boolean; content?: unknown }[]) {
          if (block.type === "tool_result" && block.tool_use_id) {
            onEvent({
              type: "tool_result",
              id: block.tool_use_id,
              ok: !block.is_error,
              summary: toolResultSummary(block.content ?? (message as { tool_use_result?: unknown }).tool_use_result),
            });
          }
        }
      }
      continue;
    }

    if (message.type === "result") {
      const result = message as {
        subtype: string;
        is_error?: boolean;
        stop_reason?: string | null;
        errors?: string[];
        usage?: { input_tokens?: number; output_tokens?: number };
        modelUsage?: Record<string, { inputTokens?: number; outputTokens?: number }>;
      };
      let inputTokens = result.usage?.input_tokens ?? 0;
      let outputTokens = result.usage?.output_tokens ?? 0;
      if (!inputTokens && !outputTokens && result.modelUsage) {
        for (const mu of Object.values(result.modelUsage)) {
          inputTokens += mu.inputTokens ?? 0;
          outputTokens += mu.outputTokens ?? 0;
        }
      }
      onEvent({ type: "usage", inputTokens, outputTokens });
      onEvent({
        type: "done",
        stopReason: result.stop_reason ?? result.subtype,
        isError: !!result.is_error || result.subtype !== "success",
        errors: result.errors ?? [],
      });
    }
  }
}

function gatewayEnv(homeDir: string): Record<string, string> {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY || "";
  const authHeader = (process.env.AGENT_AUTH_HEADER || "x-api-key").toLowerCase();
  const env: Record<string, string> = {
    PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
    HOME: homeDir,
    USER: "studio",
    LANG: process.env.LANG || "C.UTF-8",
    CI: "1",
  };
  if (process.env.AI_GATEWAY_BASE_URL) env.ANTHROPIC_BASE_URL = process.env.AI_GATEWAY_BASE_URL;
  if (authHeader === "bearer") env.ANTHROPIC_AUTH_TOKEN = gatewayKey;
  else env.ANTHROPIC_API_KEY = gatewayKey;
  return env;
}

export interface RunToolAgentOptions {
  model: ResolvedModel;
  prompt: string;
  /** Appended to the preset system prompt (rules + the ONE project's context). */
  system: string;
  /** In-process MCP tools; they are the agent's entire tool surface. */
  tools: ReturnType<typeof tool<any>>[];
  serverName: string;
  signal?: AbortSignal;
  maxTurns?: number;
  onEvent: (event: AgentEvent) => void;
}

/**
 * Platform agent runner: no built-in tools (no files, no shell, no web), only
 * the MCP tools the caller passes — e.g. lib/builder/agent.ts scopes them to one
 * project's repo/config/deploy actions. Runs in an empty scratch directory.
 */
export async function runToolAgent(opts: RunToolAgentOptions): Promise<void> {
  const { model, prompt, system, tools, serverName, signal, onEvent } = opts;
  if (model.route.format !== "anthropic") throw new Error("Agent mode needs a Claude model");
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ts-agent-"));
  const env = gatewayEnv(cwd);
  env.CLAUDE_AGENT_SDK_CLIENT_APP = "telescripts/platform-agent";
  const allowed = tools.map((t: { name: string }) => `mcp__${serverName}__${t.name}`);
  const hooks = {
    PreToolUse: [
      {
        hooks: [
          async (input: HookInput): Promise<HookJSONOutput> => {
            if (input.hook_event_name !== "PreToolUse") return { continue: true } as HookJSONOutput;
            const name = String(input.tool_name || "");
            if (allowed.includes(name)) return { continue: true } as HookJSONOutput;
            return { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "Tool is not on the platform agent allowlist" } as HookJSONOutput;
          },
        ],
      },
    ],
  };
  try {
    const stream = query({
      prompt,
      options: {
        cwd,
        model: model.config.upstreamModel,
        tools: [],
        allowedTools: allowed,
        mcpServers: { [serverName]: createSdkMcpServer({ name: serverName, tools }) },
        strictMcpConfig: true,
        settingSources: [],
        systemPrompt: { type: "preset", preset: "claude_code", append: system },
        permissionMode: "default",
        permissionPrompts: "none",
        hooks,
        env,
        includePartialMessages: true,
        abortController: controller,
        maxTurns: opts.maxTurns ?? 12,
      },
    });
    await pipeEvents(stream, controller, onEvent);
  } catch (e: any) {
    onEvent({ type: "error", message: redactSecrets(e?.message || "Agent run failed") });
  } finally {
    if (signal) signal.removeEventListener("abort", onAbort);
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}
