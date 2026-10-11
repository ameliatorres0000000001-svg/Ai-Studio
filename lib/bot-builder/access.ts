import { isAdminEmail } from "@/lib/admin";

// SERVER-ONLY. Who may use the no-code Bot Builder.
//
// The feature ships closed: admins always have access (so it can be tested in
// production), and everyone else only once FEATURE_BOT_BUILDER=true. Flipping
// that env var is the single switch that opens it up.

export function isBotBuilderEnabled(): boolean {
  return (process.env.FEATURE_BOT_BUILDER || "").trim().toLowerCase() === "true";
}

export function canUseBotBuilder(email: string | null | undefined): boolean {
  if (isAdminEmail(email)) return true;
  return isBotBuilderEnabled();
}
