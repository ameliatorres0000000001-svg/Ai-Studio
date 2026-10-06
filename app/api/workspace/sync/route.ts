import { NextResponse } from "next/server";
import { getRepoInfo, getCloneUrl, isGitHubConfigured } from "@/lib/github";
import { cloneRepo, pullLatest, getWorkspacePath } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activities";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isGitHubConfigured()) {
    return NextResponse.json(
      {
        error: "GitHub is not configured",
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

    const [owner, repo] = repoFullName.split("/");
    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Invalid repository name. Expected owner/repo format." },
        { status: 400 }
      );
    }

    const repoInfo = await getRepoInfo(owner, repo);

    const { data: existing } = await supabaseAdmin
      .from("workspaces")
      .select("*")
      .eq("repo_full_name", repoFullName)
      .maybeSingle();

    let workspaceId: string;
    let localPath: string;

    if (existing) {
      workspaceId = existing.id;
      localPath = getWorkspacePath(workspaceId);
      if (fs.existsSync(localPath)) {
        await supabaseAdmin
          .from("workspaces")
          .update({ status: "syncing", updated_at: new Date().toISOString() })
          .eq("id", workspaceId);
        try {
          await pullLatest(localPath);
        } catch {
          await cloneRepo(workspaceId, getCloneUrl(owner, repo), repoInfo.default_branch);
        }
      } else {
        await cloneRepo(workspaceId, getCloneUrl(owner, repo), repoInfo.default_branch);
      }
      await supabaseAdmin
        .from("workspaces")
        .update({
          status: "ready",
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspaceId);
      await logActivity(workspaceId, "sync", `Synced ${repoFullName}`, null, "success");
    } else {
      const { data: newWs, error } = await supabaseAdmin
        .from("workspaces")
        .insert({
          repo_full_name: repoFullName,
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
        getCloneUrl(owner, repo),
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
      await logActivity(workspaceId, "clone", `Cloned ${repoFullName}`, null, "success");
    }

    const { data: ws } = await supabaseAdmin
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .single();

    return NextResponse.json({ workspace: ws });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
