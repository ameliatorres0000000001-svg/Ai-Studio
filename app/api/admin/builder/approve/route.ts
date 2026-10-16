import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";
import { supabaseStore } from "@/lib/builder/store";
import { parseApproval } from "@/lib/builder/approval";
import { errorResponse } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

/**
 * ADMIN ONLY. Grants the platform agent a short-lived approval for destructive
 * actions on one project: { projectId, actions: ["change_env"|"delete_project"|"force_redeploy_all"], minutes ≤ 60 }.
 * DELETE revokes all approvals for the project.
 */
export async function POST(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;
  if (!isAdminEmail(user?.email)) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const body = await req.json().catch(() => ({}));
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const project = projectId ? await supabaseStore.getProject(projectId) : null;
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const parsed = parseApproval(body);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const until = new Date(Date.now() + parsed.minutes * 60_000).toISOString();
    await supabaseStore.updateProject(project.id, { approved_actions: parsed.actions, approved_until: until });
    await supabaseStore.audit({ actor: `admin:${user!.email}`, project_id: project.id, action: "approval.grant", detail: JSON.stringify({ actions: parsed.actions, until }) });
    return NextResponse.json({ ok: true, actions: parsed.actions, approvedUntil: until });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;
  if (!isAdminEmail(user?.email)) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const projectId = new URL(req.url).searchParams.get("projectId") || "";
    const project = projectId ? await supabaseStore.getProject(projectId) : null;
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    await supabaseStore.updateProject(project.id, { approved_actions: [], approved_until: null });
    await supabaseStore.audit({ actor: `admin:${user!.email}`, project_id: project.id, action: "approval.revoke", detail: "" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
