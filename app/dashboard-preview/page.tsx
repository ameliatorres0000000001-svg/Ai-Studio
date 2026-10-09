"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import DashboardPreview from "@/components/DashboardPreview";

/** Admin-only UI demo. Non-admins see a refusal; nothing here calls a model. */
export default function DashboardPreviewPage() {
  const [gate, setGate] = useState<"loading" | "denied" | "ok">("loading");

  useEffect(() => {
    api
      .adminMe()
      .then(({ isAdmin }) => setGate(isAdmin ? "ok" : "denied"))
      .catch(() => setGate("denied"));
  }, []);

  if (gate === "loading") return null;
  if (gate === "denied") {
    return (
      <main style={{ padding: 32 }}>
        <div className="chat-error">Admin only</div>
      </main>
    );
  }
  return <DashboardPreview />;
}
