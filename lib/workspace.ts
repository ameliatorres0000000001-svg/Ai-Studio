import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { simpleGit } from "simple-git";
import type { FileNode, CommandResult } from "./types";

// SERVER-ONLY. Filesystem + git + command execution for cloned workspaces.

const WORKSPACE_ROOT = path.resolve(
  process.env.WORKSPACE_ROOT || path.join(process.cwd(), ".workspaces")
);

const MAX_FILE_READ_BYTES = 512 * 1024;
const MAX_FILE_WRITE_BYTES = 1024 * 1024;
const MAX_TREE_ENTRIES = 5000;
const MAX_DIFF_CHARS = 500_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ensureWorkspaceRoot(): void {
  if (!fs.existsSync(WORKSPACE_ROOT)) {
    fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });
  }
}

// ─── Secrets hygiene ─────────────────────────────────────────

/** Strip known secrets (and credentialed GitHub URLs) from any text before it leaves the server. */
export function redactSecrets(text: string): string {
  if (!text) return text;
  let out = text.replace(/https:\/\/[^@\s/]+@github\.com/gi, "https://***@github.com");
  // Telegram bot tokens look like 123456789:AA... and appear in API URLs as /bot<token>/.
  out = out.replace(/\bbot\d{5,}:[A-Za-z0-9_-]{30,}/g, "bot***");
  out = out.replace(/\b\d{5,}:[A-Za-z0-9_-]{30,}\b/g, "***");
  for (const key of [
    "GITHUB_ACCESS_TOKEN",
    "ANTHROPIC_API_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "VERCEL_TOKEN",
    "TELEGRAM_BOT_TOKEN",
  ]) {
    const v = process.env[key];
    if (v && v.length >= 8) out = out.split(v).join("***");
  }
  return out;
}

function stripCredentials(url: string): string {
  const u = new URL(url);
  u.username = "";
  u.password = "";
  return u.toString();
}

// ─── Paths ───────────────────────────────────────────────────

export function getWorkspacePath(workspaceId: string): string {
  if (!UUID_RE.test(workspaceId)) {
    throw new Error("Invalid workspace id");
  }
  ensureWorkspaceRoot();
  return path.join(WORKSPACE_ROOT, workspaceId);
}

export function workspaceExists(workspaceId: string): boolean {
  return fs.existsSync(path.join(getWorkspacePath(workspaceId), ".git"));
}

/**
 * Resolve a user-supplied relative path and guarantee it stays inside `root`
 * (blocks "..", absolute paths, NUL bytes and symlink escapes).
 */
export function resolveInside(root: string, relPath: string): string {
  if (typeof relPath !== "string" || relPath.includes("\0")) {
    throw new Error("Invalid path");
  }
  if (path.isAbsolute(relPath)) {
    throw new Error("Absolute paths are not allowed");
  }
  const rootReal = fs.realpathSync(root);
  const resolved = path.resolve(rootReal, relPath);
  if (resolved !== rootReal && !resolved.startsWith(rootReal + path.sep)) {
    throw new Error("Path escapes the workspace");
  }
  // Follow symlinks on the deepest existing ancestor and re-check.
  let probe = resolved;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  const probeReal = fs.realpathSync(probe);
  if (probeReal !== rootReal && !probeReal.startsWith(rootReal + path.sep)) {
    throw new Error("Path escapes the workspace");
  }
  return resolved;
}

// ─── Git ─────────────────────────────────────────────────────

/**
 * Clone using a credentialed URL, then immediately rewrite `origin` to the
 * credential-free URL so the token never persists in .git/config.
 */
export async function cloneRepo(
  workspaceId: string,
  authedCloneUrl: string,
  branch: string
): Promise<string> {
  const localPath = getWorkspacePath(workspaceId);
  if (fs.existsSync(localPath)) {
    fs.rmSync(localPath, { recursive: true, force: true });
  }
  fs.mkdirSync(localPath, { recursive: true });
  try {
    await simpleGit().clone(authedCloneUrl, localPath, [
      "--branch",
      branch,
      "--depth",
      "1",
    ]);
    await simpleGit(localPath).remote([
      "set-url",
      "origin",
      stripCredentials(authedCloneUrl),
    ]);
  } catch (e: any) {
    fs.rmSync(localPath, { recursive: true, force: true });
    throw new Error(redactSecrets(e?.message || "git clone failed"));
  }
  return localPath;
}

export async function isWorkingTreeClean(localPath: string): Promise<boolean> {
  const status = await simpleGit(localPath).status();
  return status.isClean();
}

export async function getCurrentBranch(localPath: string): Promise<string | null> {
  const status = await simpleGit(localPath).status();
  return status.current || null;
}

/** Fast-forward pull. Refuses to run over uncommitted work. */
export async function pullLatest(
  localPath: string,
  authedCloneUrl: string
): Promise<void> {
  const git = simpleGit(localPath);
  const status = await git.status();
  if (!status.isClean()) {
    throw new Error(
      "Workspace has uncommitted changes; commit or roll back before syncing"
    );
  }
  if (!status.current) throw new Error("Workspace is on a detached HEAD");
  try {
    await git.pull(authedCloneUrl, status.current, ["--ff-only"]);
  } catch (e: any) {
    throw new Error(redactSecrets(e?.message || "git pull failed"));
  }
}

export async function createBackup(
  localPath: string,
  label: string
): Promise<string> {
  const safeLabel = label.replace(/[^A-Za-z0-9_-]/g, "");
  const tagName = `rollback-${safeLabel}-${Date.now()}`;
  await simpleGit(localPath).addTag(tagName);
  return tagName;
}

const ROLLBACK_TAG_RE = /^rollback-[A-Za-z0-9_-]{1,60}-\d{10,16}$/;

export function isValidRollbackTag(tag: unknown): tag is string {
  return typeof tag === "string" && ROLLBACK_TAG_RE.test(tag);
}

export async function rollbackToTag(
  localPath: string,
  tagName: string
): Promise<void> {
  if (!isValidRollbackTag(tagName)) {
    throw new Error("Invalid rollback tag");
  }
  const git = simpleGit(localPath);
  await git.reset(["--hard", `refs/tags/${tagName}`]);
  await git.clean("f", ["-d"]);
}

export async function getGitDiff(localPath: string): Promise<{
  diff: string;
  changedFiles: string[];
}> {
  const git = simpleGit(localPath);
  // Intent-to-add so brand-new files appear in `git diff` too.
  try {
    await git.raw(["add", "-N", "."]);
  } catch {
    /* nothing to add */
  }
  const status = await git.status();
  const changedFiles = Array.from(
    new Set([
      ...status.not_added,
      ...status.modified,
      ...status.deleted,
      ...status.created,
      ...status.renamed.map((r) => r.to),
    ])
  );
  let diff = "";
  if (changedFiles.length > 0) {
    try {
      diff = await git.diff(["--stat"]);
      const fullDiff = await git.diff();
      if (fullDiff) diff += "\n\n" + fullDiff;
      if (diff.length > MAX_DIFF_CHARS) {
        diff = diff.slice(0, MAX_DIFF_CHARS) + "\n\n[diff truncated]";
      }
    } catch (e: any) {
      throw new Error(redactSecrets(e?.message || "Unable to generate diff"));
    }
  }
  return { diff: redactSecrets(diff), changedFiles };
}

export async function commitAndPush(
  localPath: string,
  message: string,
  authedCloneUrl: string
): Promise<{ branch: string; commit: string }> {
  const git = simpleGit(localPath);
  const before = await git.status();
  if (before.isClean()) {
    throw new Error("No changes to commit");
  }
  if (!before.current) throw new Error("Workspace is on a detached HEAD");

  await git.addConfig(
    "user.name",
    process.env.GIT_COMMIT_NAME || "Claude Code Studio",
    false,
    "local"
  );
  await git.addConfig(
    "user.email",
    process.env.GIT_COMMIT_EMAIL || "studio@users.noreply.github.com",
    false,
    "local"
  );

  await git.add(".");
  const result = await git.commit(message);
  try {
    await git.push(authedCloneUrl, `HEAD:refs/heads/${before.current}`);
  } catch (e: any) {
    throw new Error(
      "Committed locally but push failed: " + redactSecrets(e?.message || "git push failed")
    );
  }
  return { branch: before.current, commit: result.commit };
}

// ─── Files ───────────────────────────────────────────────────

const TREE_SKIP = new Set(["node_modules", ".next", "dist", "build"]);

export function readFileTree(dirPath: string, basePath: string = dirPath): FileNode[] {
  let count = 0;
  function walk(dir: string): FileNode[] {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    const nodes: FileNode[] = [];
    for (const item of items) {
      if (count >= MAX_TREE_ENTRIES) break;
      if (item.name.startsWith(".") || TREE_SKIP.has(item.name)) continue;
      if (item.isSymbolicLink()) continue;
      count++;
      const fullPath = path.join(dir, item.name);
      const relPath = path.relative(basePath, fullPath);
      if (item.isDirectory()) {
        nodes.push({ name: item.name, path: relPath, type: "dir", children: walk(fullPath) });
      } else {
        nodes.push({ name: item.name, path: relPath, type: "file" });
      }
    }
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }
  return walk(dirPath);
}

export function readFileContent(localPath: string, filePath: string): string {
  const fullPath = resolveInside(localPath, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    throw new Error("Path is a directory, not a file");
  }
  if (stat.size > MAX_FILE_READ_BYTES) {
    return "File too large to display (>512KB)";
  }
  const buf = fs.readFileSync(fullPath);
  if (buf.includes(0)) return "Binary file — not displayed";
  return buf.toString("utf-8");
}

export function writeFileContent(
  localPath: string,
  filePath: string,
  content: string
): void {
  const fullPath = resolveInside(localPath, filePath);
  const rel = path.relative(fs.realpathSync(localPath), fullPath);
  if (rel.split(path.sep).includes(".git")) {
    throw new Error("Writing inside .git is not allowed");
  }
  if (Buffer.byteLength(content, "utf-8") > MAX_FILE_WRITE_BYTES) {
    throw new Error(`File too large to write: ${filePath}`);
  }
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  // Re-check after creating directories (symlink race / escape).
  resolveInside(localPath, filePath);
  fs.writeFileSync(fullPath, content, "utf-8");
}

// ─── Command execution ───────────────────────────────────────
//
// Commands are tokenised and run with execFile (NO shell), so shell chaining,
// substitution, redirects and globbing cannot happen. The child process gets a
// minimal environment so server secrets are not inherited.
//
// NOTE: this is NOT a sandbox. `npm run`, `npx` and `node script.js` execute
// code from the repository. Run this service in an isolated container/VM.

const ALLOWED_COMMANDS = new Set([
  "npm", "npx", "node", "yarn", "pnpm", "tsc", "eslint", "prettier", "git", "cat", "ls",
]);
const ALLOWED_GIT_SUBCOMMANDS = new Set(["status", "diff", "log", "branch", "show"]);
const SHELL_META = /[;&|<>`$(){}\\!*?~"'#\n\r\0]/;
const BLOCKED_NODE_FLAGS = new Set(["-e", "--eval", "-p", "--print", "-r", "--require", "--import"]);

export function validateCommand(command: string): {
  valid: boolean;
  reason?: string;
  argv?: string[];
} {
  if (typeof command !== "string") return { valid: false, reason: "Invalid command" };
  const trimmed = command.trim();
  if (!trimmed) return { valid: false, reason: "Empty command" };
  if (trimmed.length > 500) return { valid: false, reason: "Command too long" };
  if (SHELL_META.test(trimmed)) {
    return { valid: false, reason: "Command contains shell metacharacters or quotes" };
  }

  const argv = trimmed.split(/\s+/);
  const base = argv[0];
  if (!ALLOWED_COMMANDS.has(base)) {
    return {
      valid: false,
      reason: `Command "${base}" is not in the allowlist. Allowed: ${Array.from(ALLOWED_COMMANDS).join(", ")}`,
    };
  }
  if (base === "git" && !ALLOWED_GIT_SUBCOMMANDS.has(argv[1] || "")) {
    return {
      valid: false,
      reason: `git subcommand not allowed. Allowed: ${Array.from(ALLOWED_GIT_SUBCOMMANDS).join(", ")}. Use the Commit button to commit/push.`,
    };
  }
  if (base === "node" && argv.slice(1).some((a) => BLOCKED_NODE_FLAGS.has(a))) {
    return { valid: false, reason: "Inline evaluation / preload flags are not allowed" };
  }
  for (const a of argv.slice(1)) {
    if (a.includes("..") && (base === "cat" || base === "ls")) {
      return { valid: false, reason: "Path traversal is not allowed" };
    }
  }
  return { valid: true, argv };
}

function buildChildEnv(localPath: string): NodeJS.ProcessEnv {
  const home = path.join(WORKSPACE_ROOT, ".home");
  fs.mkdirSync(home, { recursive: true });
  const binDir = path.join(localPath, "node_modules", ".bin");
  const env: Record<string, string | undefined> = {
    PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}`,
    HOME: home,
    LANG: process.env.LANG || "C.UTF-8",
    CI: "1",
    NO_COLOR: "1",
    npm_config_update_notifier: "false",
    GIT_TERMINAL_PROMPT: "0",
  };
  return env as NodeJS.ProcessEnv;
}

export async function runCommand(
  localPath: string,
  command: string,
  timeoutMs: number = 120000
): Promise<CommandResult> {
  const validation = validateCommand(command);
  if (!validation.valid || !validation.argv) {
    return {
      stdout: "",
      stderr: validation.reason || "Command rejected",
      exitCode: 126,
      timedOut: false,
    };
  }
  const [file, ...args] = validation.argv;

  // cat / ls: every non-flag argument must resolve inside the workspace.
  if (file === "cat" || file === "ls") {
    try {
      for (const a of args) {
        if (!a.startsWith("-")) resolveInside(localPath, a);
      }
    } catch (e: any) {
      return { stdout: "", stderr: e.message, exitCode: 126, timedOut: false };
    }
  }

  return new Promise((resolve) => {
    execFile(
      file,
      args,
      {
        cwd: localPath,
        env: buildChildEnv(localPath),
        timeout: timeoutMs,
        killSignal: "SIGKILL",
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const err = error as (NodeJS.ErrnoException & { killed?: boolean; signal?: string; code?: any }) | null;
        const timedOut = !!(err && err.killed && err.signal);
        let exitCode: number | null = 0;
        if (err) {
          exitCode = typeof err.code === "number" ? err.code : err.code === "ENOENT" ? 127 : 1;
        }
        const extra = err && err.code === "ENOENT" ? `Command not found: ${file}\n` : "";
        resolve({
          stdout: redactSecrets(String(stdout || "")),
          stderr: redactSecrets(extra + String(stderr || "")),
          exitCode,
          timedOut,
        });
      }
    );
  });
}
