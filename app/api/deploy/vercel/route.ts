import { NextResponse } from "next/server";
import { getAuthenticatedUser, getOwnedWorkspace, supabaseAdmin } from "@/lib/supabase-server";
import { isVercelConfigured, createDeployment, getDeployment } from "@/lib/vercel";
import { parseRepoFullName, isRepoAllowed } from "@/lib/github";
import { isWorkingTreeClean, getCurrentBranch } from "@/lib/workspace";
import { logActivity } from "@/lib/activities";
import { resolveLocalPath, errorResponse } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

/**
 * POST: deploy the workspace's pushed branch to Vercel (preview by default).
 * Production requires { confirmProduction: true } in the body.
 */
export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;
  const userId = user!.id;

  if (!isVercelConfigured()) {
    return NextResponse.json(
      { error: "Vercel not configured: set VERCEL_TOKEN on the server", setupRequired: true, envVars: ["VERCEL_TOKEN"] },
      { status: 400 }
    );
  }

  let deploymentRowId: string | null = null;
  let workspaceId: string | undefined;
  try {
    const body = await req.json();
    workspaceId = body.workspaceId;
    const production = body.target === "production";

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }
    if (production && body.confirmProduction !== true) {
      return NextResponse.json(
        { error: "Production deploy requires confirmProduction: true" },
        { status: 400 }
      );
    }

    const { workspace, error: wsError } = await getOwnedWorkspace(workspaceId, userId);
    if (wsError) return wsError;
    const { localPath, error: pathError } = resolveLocalPath(workspace!);
    if (pathError) return pathError;

    const repo = parseRepoFullName(workspace!.repo_full_name);
    if (!repo || !isRepoAllowed(workspace!.repo_full_name)) {
      return NextResponse.json({ error: "Repository is not allowed" }, { status: 403 });
    }

    // Vercel builds what is on GitHub, so local-only edits would silently not deploy.
    if (!(await isWorkingTreeClean(localPath))) {
      return NextResponse.json(
        { error: "Uncommitted changes. Commit & push first; Vercel deploys what is on GitHub." },
        { status: 409 }
      );
    }
    const ref = await getCurrentBranch(localPath);
    if (!ref) {
      return NextResponse.json({ error: "Workspace is on a detached HEAD" }, { status: 409 });
    }

    const target = production ? "production" : "preview";
    const { data: row, error: insertError } = await supabaseAdmin
      .from("deployments")
      .insert({ user_id: userId, workspace_id: workspaceId, platform: "vercel", status: "pending", target })
      .select()
      .single();
    if (insertError) throw insertError;
    deploymentRowId = row.id;

    const d = await createDeployment({ owner: repo.owner, repo: repo.repo, ref, production });

    await supabaseAdmin
      .from("deployments")
      .update({ external_id: d.id, url: d.url, status: d.status })
      .eq("id", row.id);

    await logActivity({
      userId,
      workspaceId,
      type: "deploy",
      action: "vercel_deploy",
      title: `Vercel ${target} deploy started (${ref})`,
      detail: d.url || d.id,
      status: "info",
    });

    return NextResponse.json({
      deployment: { id: row.id, platform: "vercel", status: d.status, url: d.url, target },
    });
  } catch (e: any) {
    if (deploymentRowId) {
      await supabaseAdmin
        .from("deployments")
        .update({ status: "failed", error: String(e?.message || e).slice(0, 500) })
        .eq("id", deploymentRowId);
    }
    if (workspaceId) {
      await logActivity({
        userId,
        workspaceId,
        type: "deploy",
        action: "vercel_deploy",
        title: "Vercel deploy failed",
        error: String(e?.message || e).slice(0, 500),
        status: "error",
      });
    }
    return errorResponse(e, 502);
  }
}

/** GET: recent deployments for a workspace; refreshes pending ones from Vercel. */
export async function GET(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const workspaceId = new URL(req.url).searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  try {
    const { error: wsError } = await getOwnedWorkspace(workspaceId, user!.id);
    if (wsError) return wsError;

    const { data, error } = await supabaseAdmin
      .from("deployments")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user!.id)
      .eq("platform", "vercel")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;

    const rows = data || [];
    if (isVercelConfigured()) {
      await Promise.all(
        rows
          .filter((r) => r.status === "pending" && r.external_id)
          .slice(0, 3)
          .map(async (r) => {
            try {
              const d = await getDeployment(r.external_id);
              if (d.status !== r.status || d.url !== r.url) {
                const patch = { status: d.status, url: d.url, error: d.status === "failed" ? d.errorMessage || d.readyState || "failed" : null };
                await supabaseAdmin.from("deployments").update(patch).eq("id", r.id);
                Object.assign(r, patch);
              }
            } catch {
              /* keep last known status */
            }
          })
      );
    }

    return NextResponse.json({ deployments: rows });
  } catch (e) {
    return errorResponse(e);
  }
}
