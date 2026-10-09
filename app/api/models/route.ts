import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { listAvailableModels } from "@/lib/ai";

export const dynamic = "force-dynamic";

/** Models whose route env vars are set on the server. Ids and labels only: no routes, keys or env names. */
export async function GET(req: Request) {
  const { error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  return NextResponse.json({ models: listAvailableModels() });
}
