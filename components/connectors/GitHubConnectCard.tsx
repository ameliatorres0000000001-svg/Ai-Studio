"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Button, StatusBadge, Spinner, ErrorState } from "@/components/ui";
import { Avatar } from "@/components/ui/primitives";

interface ConnStatus {
  connected: boolean;
  login: string | null;
  avatarUrl: string | null;
  oauthConfigured: boolean;
  adminFallback: boolean;
}

export function GitHubConnectCard({ onChanged }: { onChanged?: () => void }) {
  const { lang } = useLang();
  const kh = lang === "kh";
  const [status, setStatus] = useState<ConnStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api.githubConnectorStatus()
      .then((s) => setStatus(s))
      .catch((e) => setError(e.message));
  };

  useEffect(load, []);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const { authUrl } = await api.githubConnectStart();
      window.location.href = authUrl;
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      await api.githubDisconnect();
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="connector-card">
      <div className="connector-head">
        <div className="connector-title">
          <span className="integration-icon">◈</span>
          <div>
            <strong>GitHub</strong>
            <div className="connector-meta">
              {status?.connected && status.login
                ? `${kh ? "បានតភ្ជាប់ជា" : "Connected as"} ${status.login}`
                : kh ? "ភ្ជាប់គណនី GitHub របស់អ្នក" : "Connect your GitHub account"}
            </div>
          </div>
        </div>
        <StatusBadge status={status?.connected ? "connected" : "disconnected"} />
      </div>

      {error && <div style={{ marginTop: 8 }}><ErrorState message={error} /></div>}
      {!status && !error && <Spinner label={kh ? "កំពុងផ្ទុក..." : "Loading…"} />}

      {status?.connected && status.login && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <Avatar name={status.login} src={status.avatarUrl || undefined} />
          <strong>{status.login}</strong>
        </div>
      )}

      {status && (
        <div className="connector-actions">
          {status.connected ? (
            <Button variant="secondary" onClick={disconnect} disabled={busy}>
              {busy ? "…" : kh ? "ផ្ដាច់ការតភ្ជាប់" : "Disconnect"}
            </Button>
          ) : status.oauthConfigured ? (
            <Button onClick={connect} disabled={busy}>
              {busy ? "…" : kh ? "ភ្ជាប់ GitHub" : "Connect GitHub"}
            </Button>
          ) : (
            <p className="connector-meta">
              {kh
                ? "កំណត់ GITHUB_OAUTH_CLIENT_ID និង GITHUB_OAUTH_CLIENT_SECRET លើ server ដើម្បីបើកការភ្ជាប់។"
                : "Set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET on the server to enable connecting."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
