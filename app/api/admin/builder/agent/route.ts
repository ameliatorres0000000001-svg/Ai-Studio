import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";
import { supabaseStore } from "@/lib/builder/store";
import { runProjectAgent, containsSecret } from "@/lib/builder/agent";
import { resolveBotBuilderModel } from "@/lib/bot-builder/requirements-agent";
import { errorResponse } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * ADMIN ONLY ("dev superadmin"): run the platform agent on one project.
 * Same project-scoped tools as the owner's agent; destructive tools still need
 * an approval from /api/admin/builder/approve. Everything is audited.
 */
export async function POST(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;
  if (!isAdminEmail(user?.email)) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const body = await req.json().catch(() => ({}));
    const project = typeof body.projectId === "string" ? await supabaseStore.getProject(body.projectId) : null;
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const instruction = typeof body.instruction === "string" ? body.instruction.trim().slice(0, 4000) : "";
    if (!instruction || containsSecret(instruction)) return NextResponse.json({ error: "A plain instruction without secrets is required" }, { status: 400 });
    const model = resolveBotBuilderModel();
    if (!model) return NextResponse.json({ error: "No model configured", setupRequired: true }, { status: 400 });
    const result = await runProjectAgent({ projectId: project.id, actor: `admin:${user!.email}`, instruction, model, signal: req.signal });
    return NextResponse.json({ reply: result.reply, actions: result.actions });
  } catch (e) {
    return errorResponse(e);
  }
}
