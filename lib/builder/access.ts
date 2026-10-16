// SERVER-ONLY. Auth + ownership for /api/builder/* (getOwnedWorkspace-style:
// a project is found only by id AND user_id; anything else is a 404).

import { NextResponse } from "next/server";
import { getAuthenticatedUser, type AuthUser } from "@/lib/supabase-server";
import { canUseBotBuilder } from "@/lib/bot-builder/access";
import { supabaseStore } from "./store";
import type { ProjectRow } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function requireBuilderUser(req: Request): Promise<{ user: AuthUser | null; error: NextResponse | null }> {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return { user: null, error };
  if (!canUseBotBuilder(user?.email)) {
    return { user: null, error: NextResponse.json({ error: "Bot Builder is not enabled for this account" }, { status: 403 }) };
  }
  return { user, error: null };
}

export async function getOwnedProject(id: string, userId: string): Promise<{ project: ProjectRow | null; error: NextResponse | null }> {
  const notFound = { project: null, error: NextResponse.json({ error: "Project not found" }, { status: 404 }) };
  if (!UUID_RE.test(id)) return notFound;
  const project = await supabaseStore.getProject(id);
  if (!project || project.user_id !== userId || project.status === "deleted") return notFound;
  return { project, error: null };
}
