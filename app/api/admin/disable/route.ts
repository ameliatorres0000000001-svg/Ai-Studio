import { NextResponse } from "next/server";
import { getAuthenticatedUser, supabaseAdmin } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";
import { logActivity } from "@/lib/activities";
import { sanitizeError } from "@/lib/claude";

export const dynamic = "force-dynamic";

/** Admin: ban / unban a Supabase auth user. Logged to activities. */
export async function POST(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  let userId = "";
  let disabled = false;
  try {
    const body = await req.json();
    userId = String(body.userId || "");
    disabled = body.disabled === true;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: disabled ? "876000h" : "none",
    });
    if (banErr) throw banErr;

    await logActivity({
      userId: user!.id,
      workspaceId: null,
      type: "admin",
      action: disabled ? "disable_user" : "enable_user",
      title: `${disabled ? "Disabled" : "Enabled"} user ${userId}`,
      status: "info",
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}
