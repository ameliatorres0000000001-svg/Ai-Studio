// SERVER-ONLY. Supabase (service role) implementation of BuilderStore.
// Ownership checks happen in the API routes; this layer only persists.

import { supabaseAdmin } from "@/lib/supabase-server";
import { redactSecrets } from "@/lib/redact";
import type {
  AuditEntry,
  BuilderStore,
  EventRow,
  EventStatus,
  InstanceRow,
  ProjectRow,
  PublicProject,
  RunRow,
  StepName,
} from "./types";

function fail(what: string, error: { message?: string } | null): never {
  throw new Error(`${what}: ${redactSecrets(error?.message || "unknown error")}`);
}

export const supabaseStore: BuilderStore = {
  async getProject(id) {
    const { data, error } = await supabaseAdmin.from("builder_projects").select("*").eq("id", id).maybeSingle();
    if (error) fail("getProject", error);
    return (data as ProjectRow | null) ?? null;
  },

  async updateProject(id, patch) {
    const { error } = await supabaseAdmin.from("builder_projects").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) fail("updateProject", error);
  },

  async findProjectByPendingUsername(username) {
    const { data, error } = await supabaseAdmin
      .from("builder_projects")
      .select("*")
      .ilike("pending_bot_username", username.replace(/[%_\\]/g, (c) => `\\${c}`))
      .neq("status", "deleted")
      .limit(1)
      .maybeSingle();
    if (error) fail("findProjectByPendingUsername", error);
    return (data as ProjectRow | null) ?? null;
  },

  async getRun(id) {
    const { data, error } = await supabaseAdmin.from("builder_runs").select("*").eq("id", id).maybeSingle();
    if (error) fail("getRun", error);
    return (data as RunRow | null) ?? null;
  },

  async latestRun(projectId) {
    const { data, error } = await supabaseAdmin
      .from("builder_runs")
      .select("*")
      .eq("project_id", projectId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fail("latestRun", error);
    return (data as RunRow | null) ?? null;
  },

  async createRun(projectId, step: StepName) {
    const { data, error } = await supabaseAdmin.from("builder_runs").insert({ project_id: projectId, step, status: "queued" }).select("*").single();
    if (error || !data) fail("createRun", error);
    return data as RunRow;
  },

  async updateRun(id, patch) {
    const { error } = await supabaseAdmin.from("builder_runs").update(patch).eq("id", id);
    if (error) fail("updateRun", error);
  },

  async acquireLock(runId, ttlMs) {
    const now = new Date();
    const until = new Date(now.getTime() + ttlMs).toISOString();
    // Conditional update = atomic compare-and-set on the lease.
    const { data, error } = await supabaseAdmin
      .from("builder_runs")
      .update({ locked_until: until })
      .eq("id", runId)
      .or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`)
      .select("id");
    if (error) fail("acquireLock", error);
    return Array.isArray(data) && data.length === 1;
  },

  async releaseLock(runId) {
    const { error } = await supabaseAdmin.from("builder_runs").update({ locked_until: null }).eq("id", runId);
    if (error) fail("releaseLock", error);
  },

  async addEvent(runId, step, status: EventStatus, message) {
    const { error } = await supabaseAdmin.from("builder_events").insert({ run_id: runId, step, status, message: redactSecrets(message).slice(0, 2000) });
    if (error) fail("addEvent", error);
  },

  async listEvents(runId, afterId = 0) {
    const { data, error } = await supabaseAdmin
      .from("builder_events")
      .select("*")
      .eq("run_id", runId)
      .gt("id", afterId)
      .order("id", { ascending: true })
      .limit(500);
    if (error) fail("listEvents", error);
    return (data as EventRow[]) || [];
  },

  async getInstance(projectId) {
    const { data, error } = await supabaseAdmin.from("bot_instances").select("*").eq("project_id", projectId).maybeSingle();
    if (error) fail("getInstance", error);
    return (data as InstanceRow | null) ?? null;
  },

  async getInstanceByTelegramId(botId) {
    const { data, error } = await supabaseAdmin.from("bot_instances").select("*").eq("telegram_bot_id", botId).maybeSingle();
    if (error) fail("getInstanceByTelegramId", error);
    return (data as InstanceRow | null) ?? null;
  },

  async upsertInstance(projectId, patch) {
    const { data, error } = await supabaseAdmin
      .from("bot_instances")
      .upsert({ project_id: projectId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "project_id" })
      .select("*")
      .single();
    if (error || !data) fail("upsertInstance", error);
    return data as InstanceRow;
  },

  async audit(entry: AuditEntry) {
    const { error } = await supabaseAdmin.from("agent_audit_log").insert({ ...entry, detail: redactSecrets(entry.detail).slice(0, 4000) });
    if (error) fail("audit", error);
  },
};

/** Browser-safe project view: no tokens, secrets, encrypted columns or approval internals. */
export function toPublicProject(project: ProjectRow, instance: InstanceRow | null, run: RunRow | null): PublicProject {
  return {
    id: project.id,
    name: project.name,
    template: project.template,
    status: project.status,
    createdAt: project.created_at,
    spec: project.requirements?.spec ?? null,
    config: project.requirements?.configOverride ?? project.requirements?.filledConfig ?? null,
    managedLink: project.status === "live" ? null : project.managed_link,
    suggestedUsername: project.pending_bot_username,
    bot: instance
      ? {
          username: instance.username,
          status: instance.status,
          url: instance.vercel_url,
          miniAppUrl: project.template === "shop-bot" && instance.vercel_url ? `${instance.vercel_url}/` : null,
          linked: !!instance.token_enc,
        }
      : null,
    run: run
      ? { id: run.id, status: run.status, step: run.step, error: run.error ? redactSecrets(run.error) : null, startedAt: run.started_at, finishedAt: run.finished_at }
      : null,
  };
}
