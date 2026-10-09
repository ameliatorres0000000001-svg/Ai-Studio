// SERVER-ONLY. Admin allowlist shared by all /api/admin/* routes.

/** True when the email is in ADMIN_EMAILS. An empty allowlist means nobody is admin. */
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}
