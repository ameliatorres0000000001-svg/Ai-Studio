import { NextResponse } from "next/server";
import { getAuthenticatedUser, supabaseAdmin } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";
import { errorResponse } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

/** ADMIN ONLY: agent_audit_log rows (optionally for one project), newest first. */
export async function GET(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;
  if (!isAdminEmail(user?.email)) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const projectId = new URL(req.url).searchParams.get("projectId");
    let q = supabaseAdmin.from("agent_audit_log").select("*").order("created_at", { ascending: false }).limit(200);
    if (projectId) q = q.eq("project_id", projectId);
    const { data, error: dbError } = await q;
    if (dbError) throw new Error(dbError.message);
    return NextResponse.json({ entries: data || [] });
  } catch (e) {
    return errorResponse(e);
  }
}
