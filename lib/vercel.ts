// SERVER-ONLY. VERCEL_TOKEN is read from the environment and never leaves the server.

const API = "https://api.vercel.com";

export function isVercelConfigured(): boolean {
  return !!process.env.VERCEL_TOKEN;
}

function authHeaders(): Record<string, string> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN is not configured");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function teamQuery(): string {
  const team = process.env.VERCEL_TEAM_ID;
  return team ? `?teamId=${encodeURIComponent(team)}` : "";
}

/** Vercel project names: lowercase letters, digits, '.', '_', '-'; max 100 chars. */
export function toVercelProjectName(repo: string): string {
  const base = (process.env.VERCEL_PROJECT_NAME || repo)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .slice(0, 100);
  return base || "project";
}

export type DeployStatus = "pending" | "success" | "failed";

export function mapReadyState(readyState: string | undefined): DeployStatus {
  if (readyState === "READY") return "success";
  if (readyState === "ERROR" || readyState === "CANCELED") return "failed";
  return "pending"; // QUEUED, INITIALIZING, BUILDING, unknown
}

async function parse(res: Response): Promise<any> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const msg = body?.error?.message || `Vercel API error (${res.status})`;
    throw new Error(msg);
  }
  return body;
}

export interface VercelDeployment {
  id: string;
  url: string | null;
  status: DeployStatus;
  readyState?: string;
  errorMessage?: string;
}

/**
 * Deploys a branch of a GitHub repo. Requires the Vercel GitHub integration to have
 * access to that repository (Vercel dashboard -> Git). Nothing is uploaded from this server.
 */
export async function createDeployment(opts: {
  owner: string;
  repo: string;
  ref: string;
  production: boolean;
}): Promise<VercelDeployment> {
  const name = toVercelProjectName(opts.repo);
  const body: Record<string, unknown> = {
    name,
    gitSource: { type: "github", org: opts.owner, repo: opts.repo, ref: opts.ref },
  };
  if (process.env.VERCEL_PROJECT_NAME) body.project = name;
  if (opts.production) body.target = "production";

  const res = await fetch(`${API}/v13/deployments${teamQuery()}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const d = await parse(res);
  return {
    id: d.id,
    url: d.url ? `https://${d.url}` : null,
    status: mapReadyState(d.readyState),
    readyState: d.readyState,
  };
}

export async function getDeployment(id: string): Promise<VercelDeployment> {
  const res = await fetch(
    `${API}/v13/deployments/${encodeURIComponent(id)}${teamQuery()}`,
    { headers: authHeaders() }
  );
  const d = await parse(res);
  return {
    id: d.id,
    url: d.url ? `https://${d.url}` : null,
    status: mapReadyState(d.readyState),
    readyState: d.readyState,
    errorMessage: d.errorMessage,
  };
}

// ── Builder: one Vercel project per generated bot (docs/BACKEND-BUILDER.md) ──

function withTeam(path: string, params: Record<string, string> = {}): string {
  const q = new URLSearchParams(params);
  if (process.env.VERCEL_TEAM_ID) q.set("teamId", process.env.VERCEL_TEAM_ID);
  const s = q.toString();
  return `${API}${path}${s ? `?${s}` : ""}`;
}

/** GET /v9/projects/{idOrName} — null on 404. */
export async function getProject(idOrName: string): Promise<{ id: string; name: string } | null> {
  const res = await fetch(withTeam(`/v9/projects/${encodeURIComponent(idOrName)}`), { headers: authHeaders(), cache: "no-store" });
  if (res.status === 404) return null;
  const p = await parse(res);
  return { id: p.id, name: p.name };
}

/** POST /v11/projects — plain serverless project (no framework, no Git link). */
export async function createProject(name: string): Promise<{ id: string; name: string }> {
  const res = await fetch(withTeam("/v11/projects"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name, framework: null }),
  });
  if (res.status === 409) {
    const existing = await getProject(name);
    if (existing) return existing;
  }
  const p = await parse(res);
  return { id: p.id, name: p.name };
}

/** POST /v10/projects/{id}/env?upsert=true — values never echoed back by this function. */
export async function upsertProjectEnv(projectId: string, v: { key: string; value: string; secret: boolean }): Promise<void> {
  const res = await fetch(withTeam(`/v10/projects/${encodeURIComponent(projectId)}/env`, { upsert: "true" }), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ key: v.key, value: v.value, type: v.secret ? "encrypted" : "plain", target: ["production", "preview"] }),
  });
  if (!res.ok) {
    // Fixed message: never include the request body (it holds the value).
    throw new Error(`Vercel env update failed for ${v.key} (${res.status})`);
  }
}

/** POST /v13/deployments with inline files (no Vercel↔GitHub integration needed). */
export async function createFileDeployment(opts: { projectId: string; name: string; files: { path: string; content: string }[] }): Promise<{ id: string }> {
  const res = await fetch(withTeam("/v13/deployments", { skipAutoDetectionConfirmation: "1" }), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      name: opts.name,
      project: opts.projectId,
      target: "production",
      files: opts.files.map((f) => ({ file: f.path, data: f.content })),
      projectSettings: { framework: null },
    }),
  });
  const d = await parse(res);
  return { id: d.id };
}

/** GET /v13/deployments/{id} — prefers the stable production alias over the per-deployment URL. */
export async function getDeploymentState(id: string): Promise<{ id: string; state: string; url: string | null; error: string | null }> {
  const res = await fetch(withTeam(`/v13/deployments/${encodeURIComponent(id)}`), { headers: authHeaders(), cache: "no-store" });
  const d = await parse(res);
  const alias: string | undefined = Array.isArray(d.alias) ? d.alias[0] : undefined;
  let state: string = d.readyState || "QUEUED";
  // Production aliases are assigned right after READY; keep polling until then.
  if (state === "READY" && !alias && d.aliasAssigned === false) state = "BUILDING";
  const host = alias || d.url;
  return { id: d.id, state, url: host ? `https://${host}` : null, error: d.errorMessage || null };
}
