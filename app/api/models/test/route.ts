import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { providerFor, resolveModel } from "@/lib/ai";
import { sanitizeError } from "@/lib/claude";

export const dynamic = "force-dynamic";

/**
 * Admin-only model connectivity test. Sends "reply OK" (max_tokens 16).
 * Returns { ok, latencyMs, error }. Route credentials never leave the server.
 */
function isAdmin(email: string): boolean {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (admins.length > 0) return admins.includes(email.toLowerCase());
  // Fallback: the first allowlisted email is the workspace owner.
  const allowed = (process.env.ALLOWED_USER_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length > 0) return allowed[0] === email.toLowerCase();
  return process.env.NODE_ENV !== "production";
}

export async function POST(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  let modelId: unknown;
  try {
    ({ modelId } = await req.json());
  } catch {
    return NextResponse.json(
      { ok: false, latencyMs: 0, error: "modelId is required" },
      { status: 400 }
    );
  }

  const model = resolveModel(modelId);
  if (!model) {
    return NextResponse.json(
      { ok: false, latencyMs: 0, error: "Unknown or unavailable model" },
      { status: 400 }
    );
  }

  const started = Date.now();
  try {
    await providerFor(model.route.format).send(
      [{ role: "user", content: "reply OK" }],
      model,
      undefined,
      { maxTokens: 16 }
    );
    return NextResponse.json({ ok: true, latencyMs: Date.now() - started, error: null });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      latencyMs: Date.now() - started,
      error: sanitizeError(e),
    });
  }
}
