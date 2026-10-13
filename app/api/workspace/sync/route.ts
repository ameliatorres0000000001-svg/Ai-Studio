import { NextResponse } from "next/server";
import { getRepoInfo, getCloneUrl, isGitHubConfigured, isRepoAllowed, parseRepoFullName } from "@/lib/github";
import { cloneRepo, pullLatest, getWorkspacePath, isWorkingTreeClean } from "@/lib/workspace";
import { getAuthenticatedUser, supabaseAdmin, getOwnedWorkspace, toPublicWorkspace } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activities";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;
  const userId = user!.id;

  if (!isGitHubConfigured()) {
    return NextResponse.json(
      {
        error: "Not connected — Configure in Settings",
        setupRequired: true,
        envVars: ["GITHUB_ACCESS_TOKEN"],
      },
      { status: 400 }
    );
  }

  try {
    const { repoFullName } = await req.json();
    if (!repoFullName || typeof repoFullName !== "string") {
      return NextResponse.json(
        { error: "repoFullName is required" },
        { status: 400 }
      );
    }

    const parsed = parseRepoFullName(repoFullName);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid repository name. Expected owner/repo format." },
        { status: 400 }
      );
    }
    if (!isRepoAllowed(`${parsed.owner}/${parsed.repo}`)) {
      return NextResponse.json(
        { error: "Repository is not allowed" },
        { status: 403 }
      );
    }

    const repoInfo = await getRepoInfo(parsed.owner, parsed.repo);
    const canonicalFullName = repoInfo.full_name;
    if (!isRepoAllowed(canonicalFullName)) {
      return NextResponse.json(
        { error: "Repository is not allowed" },
        { status: 403 }
      );
    }

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
      localPath = getWorkspacePath(workspaceId);
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
        await pullLatest(localPath, getCloneUrl(parsed.owner, parsed.repo));
      } else {
        await cloneRepo(workspaceId, getCloneUrl(parsed.owner, parsed.repo), repoInfo.default_branch);
      }
      await supabaseAdmin
        .from("workspaces")
        .update({
          status: "ready",
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
          repo_default_branch: repoInfo.default_branch,
          local_path: "",
          status: "syncing",
        })
        .select()
        .single();
      if (error) throw error;

      workspaceId = newWs.id;
      localPath = await cloneRepo(
        workspaceId,
        getCloneUrl(parsed.owner, parsed.repo),
        repoInfo.default_branch
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
