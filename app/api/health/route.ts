import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { isGitHubConfigured } from "@/lib/github";
import { isClaudeConfigured } from "@/lib/claude";
import { isVercelConfigured } from "@/lib/vercel";

export const dynamic = "force-dynamic";

/** Reports which server-side integrations are configured (booleans only, never values). */
export async function GET(req: Request) {
  const { error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  return NextResponse.json({
    github: isGitHubConfigured(),
    claude: isClaudeConfigured(),
    vercel: isVercelConfigured(),
    supabase: !!(
      (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
  });
}
