"use client";

import { TelegramConnector } from "@/components/TelegramConnector";
import { GitHubConnectCard } from "@/components/connectors/GitHubConnectCard";
import { useLang } from "@/lib/i18n";
import { StatusBadge } from "@/components/ui";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function ConnectorsPage() {
  const { lang } = useLang();
  const kh = lang === "kh";
  const [health, setHealth] = useState<{ vercel?: boolean } | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  return (
    <main className="wrap" style={{ maxWidth: 720, margin: "0 auto", padding: 32 }}>
      <h1 style={{ fontSize: 20, marginBottom: 18 }}>
        {kh ? "ការតភ្ជាប់" : "Connectors"}
      </h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <GitHubConnectCard />
        <TelegramConnector />
        <div className="connector-card">
          <div className="connector-head">
            <div className="connector-title">
              <span className="integration-icon">▲</span>
              <div>
                <strong>Vercel</strong>
                <div className="connector-meta">{kh ? "ការបង្ហោះ" : "Deployments"}</div>
              </div>
            </div>
            <StatusBadge status={health?.vercel ? "connected" : "disconnected"} />
          </div>
        </div>
      </div>
    </main>
  );
}
