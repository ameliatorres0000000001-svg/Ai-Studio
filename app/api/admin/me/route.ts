import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** Lets the UI hide /admin links for non-admins without leaking the admin list. */
export async function GET(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;
  return NextResponse.json({ isAdmin: isAdminEmail(user?.email) });
}
