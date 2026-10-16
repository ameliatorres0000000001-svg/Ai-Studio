import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { checkBotLimit } from "@/lib/entitlements";
import { errorResponse } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

/** How many bots the user has vs. their plan's limit (-1 = unlimited). */
export async function GET(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;
  try {
    const r = await checkBotLimit(user!.id, user!.email);
    return NextResponse.json({ used: r.used, limit: r.limit });
  } catch (e) {
    return errorResponse(e);
  }
}
