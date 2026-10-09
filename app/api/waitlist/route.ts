import { NextResponse } from "next/server";
import { getAuthenticatedUser, supabaseAdmin } from "@/lib/supabase-server";
import { sanitizeError } from "@/lib/claude";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Public waitlist: an email per user; duplicates collapse quietly. */
export async function POST(req: Request) {
  const { error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  let email = "";
  try {
    email = String((await req.json()).email || "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  try {
    const { error: insErr } = await supabaseAdmin.from("waitlist").insert({ email });
    if (insErr && !/duplicate key/i.test(insErr.message)) throw insErr;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
  }
}
