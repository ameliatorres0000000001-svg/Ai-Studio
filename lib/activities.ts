import { supabaseAdmin } from "./supabase-server";

export async function logActivity(
  workspaceId: string | null,
  type: string,
  title: string,
  detail: string | null = null,
  status: string = "info"
): Promise<void> {
  try {
    await supabaseAdmin.from("activities").insert({
      workspace_id: workspaceId,
      type,
      title,
      detail,
      status,
    });
  } catch {
    // Logging is best-effort; don't fail the request
  }
}

export async function getActivities(
  workspaceId?: string,
  limit: number = 50
) {
  let query = supabaseAdmin
    .from("activities")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
