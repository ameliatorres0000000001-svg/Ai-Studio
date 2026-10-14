import { NextRequest, NextResponse } from "next/server";
import { verifySignature, encryptSecret } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
const COOKIE = "github_oauth_state";

function redirect(origin: string, path: string): NextResponse {
  const res = NextResponse.redirect(new URL(path, origin));
  res.cookies.set(COOKIE, "", { maxAge: 0, path: "/api/connectors/github" });
  return res;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;
  const fail = (reason: string) => redirect(origin, `/settings/connectors?github=error&reason=${reason}`);

  const signed = req.cookies.get(COOKIE)?.value;
  if (!signed) return fail("state_missing");
  const [payloadB64, signature] = signed.split(".");
  if (!payloadB64 || !signature || !verifySignature(Buffer.from(payloadB64, "base64url").toString("utf8"), signature)) {
    return fail("state_invalid");
  }
  let payload: { state: string; userId: string; exp: number };
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return fail("state_invalid");
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return fail("state_expired");
  const state = url.searchParams.get("state");
  if (!state || state !== payload.state) return fail("state_mismatch");

  const code = url.searchParams.get("code");
  if (!code) return fail("code_missing");

  // Exchange the code for an access token.
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: `${origin}/api/connectors/github/callback`,
    }),
  });
  const tokenData = await tokenRes.json().catch(() => null) as { access_token?: string; scope?: string } | null;
  if (!tokenData?.access_token) return fail("exchange_failed");

  // Fetch the GitHub profile.
  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "CodingStudio" },
  });
  const ghUser = await userRes.json().catch(() => null) as { login?: string; avatar_url?: string } | null;
  if (!ghUser?.login) return fail("user_fetch_failed");

  await supabaseAdmin.from("github_connections").upsert({
    user_id: payload.userId,
    github_login: ghUser.login,
    avatar_url: ghUser.avatar_url ?? null,
    token_enc: encryptSecret(tokenData.access_token),
    scopes: tokenData.scope ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  return redirect(origin, "/settings/connectors?github=connected");
}
