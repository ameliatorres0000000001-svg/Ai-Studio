import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";
import { isGitHubConfigured } from "@/lib/github";
import { isClaudeConfigured } from "@/lib/claude";
import { isVercelConfigured } from "@/lib/vercel";
import { isTelegramConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/** Admin-only. Reports which integrations are configured (booleans only, never values). Feeds the dashboard connection dots. */
export async function GET(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const models = isClaudeConfigured();
  return NextResponse.json({
    github: isGitHubConfigured(),
    claude: models,
    models,
    supabase: !!(
      (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
    vercel: isVercelConfigured(),
    telegram: isTelegramConfigured(),
  });
}
