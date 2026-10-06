import fs from "fs";
import path from "path";
import { simpleGit } from "simple-git";
import type { FileNode, CommandResult } from "./types";

const WORKSPACE_ROOT = path.join(process.cwd(), ".workspaces");

function ensureWorkspaceRoot(): void {
  if (!fs.existsSync(WORKSPACE_ROOT)) {
    fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });
  }
}

export function getWorkspacePath(workspaceId: string): string {
  ensureWorkspaceRoot();
  return path.join(WORKSPACE_ROOT, workspaceId);
}

export async function cloneRepo(
  workspaceId: string,
  cloneUrl: string,
  branch: string
): Promise<string> {
  const localPath = getWorkspacePath(workspaceId);
  if (fs.existsSync(localPath)) {
    fs.rmSync(localPath, { recursive: true, force: true });
  }
  fs.mkdirSync(localPath, { recursive: true });
  const git = simpleGit();
  await git.clone(cloneUrl, localPath, ["--branch", branch, "--depth", "1"]);
  return localPath;
}

export async function pullLatest(localPath: string): Promise<void> {
  const git = simpleGit(localPath);
  await git.pull();
}

export async function createBackup(
  localPath: string,
  label: string
): Promise<string> {
  const git = simpleGit(localPath);
  const timestamp = Date.now();
  const tagName = `rollback-${label}-${timestamp}`;
  await git.addTag(tagName);
  return tagName;
}

export async function rollbackToTag(
  localPath: string,
  tagName: string
): Promise<void> {
  const git = simpleGit(localPath);
  await git.reset(["--hard", tagName]);
}

export async function getGitDiff(localPath: string): Promise<{
  diff: string;
  changedFiles: string[];
}> {
  const git = simpleGit(localPath);
  const status = await git.status();
  const changedFiles = [
    ...status.not_added,
    ...status.modified,
    ...status.deleted,
    ...status.created,
  ];
  let diff = "";
  if (changedFiles.length > 0) {
    try {
      diff = await git.diff(["--stat"]);
      const fullDiff = await git.diff();
      if (fullDiff) diff += "\n\n" + fullDiff;
    } catch {
      diff = "Unable to generate diff";
    }
  }
  return { diff, changedFiles };
}

export async function commitAndPush(
  localPath: string,
  message: string
): Promise<void> {
  const git = simpleGit(localPath);
  await git.add(".");
  await git.commit(message);
  await git.push();
}

export function readFileTree(dirPath: string, basePath: string = dirPath): FileNode[] {
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  const nodes: FileNode[] = [];
  for (const item of items) {
    if (item.name.startsWith(".") || item.name === "node_modules") continue;
    const fullPath = path.join(dirPath, item.name);
    const relPath = path.relative(basePath, fullPath);
    if (item.isDirectory()) {
      nodes.push({
        name: item.name,
        path: relPath,
        type: "dir",
        children: readFileTree(fullPath, basePath),
      });
    } else {
      nodes.push({
        name: item.name,
        path: relPath,
        type: "file",
      });
    }
  }
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function readFileContent(localPath: string, filePath: string): string {
  const fullPath = path.join(localPath, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    throw new Error("Path is a directory, not a file");
  }
  if (stat.size > 512 * 1024) {
    return "File too large to display (>512KB)";
  }
  return fs.readFileSync(fullPath, "utf-8");
}

export function writeFileContent(
  localPath: string,
  filePath: string,
  content: string
): void {
  const fullPath = path.join(localPath, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content, "utf-8");
}

const ALLOWED_COMMANDS = [
  "npm",
  "npx",
  "node",
  "yarn",
  "pnpm",
  "tsc",
  "eslint",
  "prettier",
  "git",
  "cat",
  "ls",
  "test",
];

const BLOCKED_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bsudo\b/i,
  /:/,
  /\|\s*(bash|sh|zsh)/i,
  />\s*\/dev\//i,
  /\beval\b/i,
  /\bexport\b/i,
  /\bsource\b/i,
];

export function validateCommand(command: string): {
  valid: boolean;
  reason?: string;
} {
  const trimmed = command.trim();
  if (!trimmed) return { valid: false, reason: "Empty command" };
  if (BLOCKED_PATTERNS.some((p) => p.test(trimmed))) {
    return { valid: false, reason: "Command contains a blocked pattern" };
  }
  const parts = trimmed.split(/\s+/);
  const baseCmd = parts[0];
  if (!ALLOWED_COMMANDS.includes(baseCmd)) {
    return {
      valid: false,
      reason: `Command "${baseCmd}" is not in the allowlist. Allowed: ${ALLOWED_COMMANDS.join(", ")}`,
    };
  }
  return { valid: true };
}

export async function runCommand(
  localPath: string,
  command: string,
  timeoutMs: number = 120000
): Promise<CommandResult> {
  const { exec } = await import("child_process");
  return new Promise((resolve) => {
    let timedOut = false;
    const child = exec(
      command,
      { cwd: localPath, timeout: timeoutMs, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout || "",
          stderr: stderr || "",
          exitCode: error ? (error as any).code ?? 1 : 0,
          timedOut,
        });
      }
    );
    child.on("error", () => {
      resolve({
        stdout: "",
        stderr: "Failed to spawn process",
        exitCode: null,
        timedOut: false,
      });
    });
    setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
  });
}
