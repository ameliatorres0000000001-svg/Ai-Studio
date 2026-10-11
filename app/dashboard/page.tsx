"use client";

import { PublicDashboard } from "@/components/PublicDashboard";

/**
 * Public landing page — no sign-in required to view (see AuthGate's
 * PUBLIC_PATHS). Real data and real bot-building only kick in once the user
 * clicks through to a protected route like /bot-builder, where the normal
 * AuthGate login screen takes over.
 */
export default function DashboardPage() {
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      <PublicDashboard />
    </main>
  );
}
