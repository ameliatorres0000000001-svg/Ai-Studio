import { NextResponse } from "next/server";
import { getRepoInfo, getCloneUrl, isGitHubConnected, isRepoAllowed, parseRepoFullName, GitHubNotConnectedError } from "@/lib/github";
import { cloneRepo, pullLatest, getWorkspacePath, isWorkingTreeClean } from "@/lib/workspace";
import { getAuthenticatedUser, supabaseAdmin, toPublicWorkspace } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activities";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;
  const userId = user!.id;
  const userEmail = user!.email;

  if (!(await isGitHubConnected(userId, userEmail))) {
    return NextResponse.json({ error: "GitHub account is not connected", connectRequired: true }, { status: 400 });
  }

  try {
    const { repoFullName, branch } = await req.json();
    if (!repoFullName || typeof repoFullName !== "string") {
      return NextResponse.json({ error: "repoFullName is required" }, { status: 400 });
    }

    const parsed = parseRepoFullName(repoFullName);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid repository name. Expected owner/repo format." }, { status: 400 });
    }
    if (!isRepoAllowed(`${parsed.owner}/${parsed.repo}`)) {
      return NextResponse.json({ error: "Repository is not allowed" }, { status: 403 });
    }

    const repoInfo = await getRepoInfo(userId, userEmail, parsed.owner, parsed.repo);
    const canonicalFullName = repoInfo.full_name;
    if (!isRepoAllowed(canonicalFullName)) {
      return NextResponse.json({ error: "Repository is not allowed" }, { status: 403 });
    }

    const targetBranch = typeof branch === "string" && branch.trim() ? branch.trim() : repoInfo.default_branch;

    const { data: existing } = await supabaseAdmin
      .from("workspaces")
      .select("*")
      .eq("repo_full_name", canonicalFullName)
      .eq("user_id", userId)
      .maybeSingle();

    let workspaceId: string;
    let localPath: string;

    if (existing) {
      workspaceId = existing.id;
      localPath = getWorkspacePath(workspaceId, userId);
      if (fs.existsSync(localPath)) {
        if (!(await isWorkingTreeClean(localPath))) {
          return NextResponse.json(
            { error: "Workspace has uncommitted changes; commit or roll back before syncing" },
            { status: 409 }
          );
        }
        await supabaseAdmin
          .from("workspaces")
          .update({ status: "syncing", updated_at: new Date().toISOString() })
          .eq("id", workspaceId);
        await pullLatest(localPath, await getCloneUrl(userId, userEmail, parsed.owner, parsed.repo));
      } else {
        await cloneRepo(workspaceId, await getCloneUrl(userId, userEmail, parsed.owner, parsed.repo), targetBranch, userId);
      }
      await supabaseAdmin
        .from("workspaces")
        .update({
          status: "ready",
          repo_default_branch: targetBranch,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspaceId);
      await logActivity({ userId, workspaceId, type: "sync", title: `Synced ${canonicalFullName}`, status: "success" });
    } else {
      const { data: newWs, error } = await supabaseAdmin
        .from("workspaces")
        .insert({
          user_id: userId,
          repo_full_name: canonicalFullName,
          repo_default_branch: targetBranch,
          local_path: "",
          status: "syncing",
        })
        .select()
        .single();
      if (error) throw error;

      workspaceId = newWs.id;
      localPath = await cloneRepo(
        workspaceId,
        await getCloneUrl(userId, userEmail, parsed.owner, parsed.repo),
        targetBranch,
        userId
      );

      await supabaseAdmin
        .from("workspaces")
        .update({
          local_path: localPath,
          status: "ready",
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspaceId);
      await logActivity({ userId, workspaceId, type: "clone", title: `Cloned ${canonicalFullName}`, status: "success" });
    }

    const { data: ws } = await supabaseAdmin
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .single();

    return NextResponse.json({ workspace: ws ? toPublicWorkspace(ws) : ws });
  } catch (error: any) {
    if (error instanceof GitHubNotConnectedError) {
      return NextResponse.json({ error: error.message, connectRequired: true }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
