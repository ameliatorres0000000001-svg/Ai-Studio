import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { signPayload } from "@/lib/crypto";
import { isGitHubOAuthConfigured } from "@/lib/github";

export const dynamic = "force-dynamic";
const COOKIE = "github_oauth_state";
const TTL_SECONDS = 600;

/**
 * Authenticated via Bearer token. Mints a signed httpOnly state cookie bound to
 * the user, then returns the GitHub authorize URL for the client to navigate to.
 */
export async function GET(req: Request) {
  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  if (!isGitHubOAuthConfigured()) {
    return NextResponse.json(
      { error: "GitHub OAuth is not configured", setupRequired: true, envVars: ["GITHUB_OAUTH_CLIENT_ID", "GITHUB_OAUTH_CLIENT_SECRET"] },
      { status: 400 }
    );
  }

  const state = crypto.randomBytes(32).toString("hex");
  const payload = JSON.stringify({ state, userId: user!.id, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS });
  const signed = Buffer.from(payload).toString("base64url") + "." + signPayload(payload);

  const redirectUri = `${new URL(req.url).origin}/api/connectors/github/callback`;
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_OAUTH_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope: "repo read:user",
    state,
  });

  const res = NextResponse.json({ authUrl: `https://github.com/login/oauth/authorize?${params}` });
  res.cookies.set(COOKIE, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/connectors/github",
    maxAge: TTL_SECONDS,
  });
  return res;
}
