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
