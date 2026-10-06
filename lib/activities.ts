import { supabaseAdmin } from "./supabase-server";

interface LogActivityParams {
  userId: string;
  workspaceId: string | null;
  type: string;
  title: string;
  detail?: string | null;
  status?: string;
  action?: string | null;
  prompt?: string | null;
  filesChanged?: string[] | null;
  command?: string | null;
  testResult?: string | null;
  error?: string | null;
}

export async function logActivity({
  userId,
  workspaceId,
  type,
  title,
  detail = null,
  status = "info",
  action = null,
  prompt = null,
  filesChanged = null,
  command = null,
  testResult = null,
  error = null,
}: LogActivityParams): Promise<void> {
  try {
    await supabaseAdmin.from("activities").insert({
      user_id: userId,
      workspace_id: workspaceId,
      type,
      title,
      detail,
      status,
      action,
      prompt,
      files_changed: filesChanged,
      command,
      test_result: testResult,
      error,
    });
  } catch {
    // Logging is best-effort; don't fail the request
  }
}

export async function getActivities(
  userId: string,
  workspaceId?: string,
  limit: number = 100
) {
  let query = supabaseAdmin
    .from("activities")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
