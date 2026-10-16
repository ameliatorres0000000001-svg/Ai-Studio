// SERVER-ONLY. Vercel side of the builder: one project per bot under OUR team
// (VERCEL_TOKEN / VERCEL_TEAM_ID), env injected from the encrypted store at
// deploy time, inline-file production deployments.

import { createFileDeployment, createProject, getDeploymentState, getProject, upsertProjectEnv } from "@/lib/vercel";
import type { BuilderDeps } from "./types";

export const vercelAdapter: BuilderDeps["vercel"] = {
  async ensureProject({ existingId, name }) {
    if (existingId) {
      const p = await getProject(existingId);
      if (p) return p;
    }
    return createProject(name);
  },

  async setEnv(projectId, vars) {
    for (const v of vars) await upsertProjectEnv(projectId, v);
  },

  async deploy({ projectId, projectName, files }) {
    return createFileDeployment({ projectId, name: projectName, files });
  },

  async getDeployment(id) {
    return getDeploymentState(id);
  },
};

/** Smoke-test probe: GET the bot's /api/health (JSON only, 10 s timeout). */
export async function probeHealth(url: string): Promise<{ status: number; body: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch {
    return { status: 0, body: null };
  } finally {
    clearTimeout(timer);
  }
}
