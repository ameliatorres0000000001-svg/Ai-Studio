import { NextResponse } from "next/server";
import { getAuthenticatedUser, getOwnedWorkspace } from "@/lib/supabase-server";
import { getWorkspacePath, redactSecrets, isWorkingTreeClean } from "@/lib/workspace";
import { simpleGit } from "simple-git";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const MAX_DIFF_CHARS = 200_000;

async function getGit(localPath: string) {
  return simpleGit(localPath);
}

/** GET: list changed + untracked files with unified diffs. */
export async function GET(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const workspaceId = new URL(req.url).searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });

  const { workspace, error: wsError } = await getOwnedWorkspace(workspaceId, user!.id);
  if (wsError) return wsError;

  const localPath = getWorkspacePath(workspace!.id, user!.id);
  if (!fs.existsSync(path.join(localPath, ".git"))) {
    return NextResponse.json({ error: "Workspace files are not present — sync first", syncRequired: true }, { status: 409 });
  }

  const git = await getGit(localPath);
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
  try {
    diff = await git.diff();
    const untrackedDiff = await git.diff(["--", ...status.not_added]).catch(() => "");
    if (untrackedDiff) diff += "\n" + untrackedDiff;
  } catch {
    /* empty */
  }
  if (diff.length > MAX_DIFF_CHARS) diff = diff.slice(0, MAX_DIFF_CHARS) + "\n\n[diff truncated]";

  return NextResponse.json({
    changedFiles,
    untracked: status.not_added,
    modified: [...status.modified, ...status.renamed.map((r) => r.to)],
    deleted: status.deleted,
    created: status.created,
    diff: redactSecrets(diff),
    clean: await isWorkingTreeClean(localPath),
  });
}

/**
 * POST:
 *  { action: "discard", paths?: string[] } — restore tracked changes; remove untracked files.
 *  { action: "keep" } — no-op marker clear (git is the source of truth).
 */
export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  try {
    const { workspaceId, action, paths } = await req.json();
    if (!workspaceId || !action) {
      return NextResponse.json({ error: "workspaceId and action are required" }, { status: 400 });
    }

    const { workspace, error: wsError } = await getOwnedWorkspace(workspaceId, user!.id);
    if (wsError) return wsError;

    const localPath = getWorkspacePath(workspace!.id, user!.id);
    if (!fs.existsSync(path.join(localPath, ".git"))) {
      return NextResponse.json({ error: "Workspace files are not present — sync first", syncRequired: true }, { status: 409 });
    }

    const git = await getGit(localPath);

    if (action === "keep") {
      return NextResponse.json({ ok: true });
    }

    if (action !== "discard") {
      return NextResponse.json({ error: "action must be discard or keep" }, { status: 400 });
    }

    const status = await git.status();
    const untracked = new Set(status.not_added);

    if (Array.isArray(paths) && paths.length > 0) {
      // Scoped discard: checkout tracked paths, delete untracked paths.
      const tracked = paths.filter((p) => !untracked.has(p));
      const newFiles = paths.filter((p) => untracked.has(p));
      if (tracked.length) {
        await git.checkout(["--", ...tracked]);
      }
      for (const f of newFiles) {
        const full = path.join(localPath, f);
        if (full.startsWith(localPath + path.sep)) fs.rmSync(full, { force: true, recursive: false });
      }
    } else {
      // Full discard: reset tracked, remove untracked (excluding .git).
      await git.reset(["--hard", "HEAD"]);
      await git.clean("f", ["-d", "-x", "-e", ".env*", "-e", "node_modules"]);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: redactSecrets(error?.message || "discard failed") }, { status: 500 });
  }
}
