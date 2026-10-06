"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export function ConnectionStatus() {
  const [github, setGithub] = useState<{
    configured: boolean;
    username?: string;
    setupRequired?: boolean;
    envVars?: string[];
    message?: string;
  } | null>(null);
  const [claude, setClaude] = useState<{
    configured: boolean;
    setupRequired?: boolean;
    envVars?: string[];
  } | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const gh = await api.githubStatus();
        setGithub(gh);
      } catch {
        setGithub({ configured: false });
      }
      try {
        const res = await fetch("/api/claude/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: "check", message: "check" }),
        });
        const data = await res.json();
        if (data.setupRequired) {
          setClaude({
            configured: false,
            setupRequired: true,
            envVars: data.envVars,
          });
        } else {
          setClaude({ configured: true });
        }
      } catch {
        setClaude({ configured: false });
      }
    }
    check();
  }, []);

  return (
    <div className="connection-status">
      <div className={`conn-item ${github?.configured ? "ok" : "warn"}`}>
        <span className="conn-dot">{github?.configured ? "🟢" : "🟡"}</span>
        <span>GitHub</span>
        {github?.configured && github.username && (
          <small>{github.username}</small>
        )}
        {!github?.configured && github?.setupRequired && (
          <small>Set {github.envVars?.join(", ")}</small>
        )}
      </div>
      <div className={`conn-item ${claude?.configured ? "ok" : "warn"}`}>
        <span className="conn-dot">{claude?.configured ? "🟢" : "🟡"}</span>
        <span>Claude</span>
        {!claude?.configured && claude?.setupRequired && (
          <small>Set {claude.envVars?.join(", ")}</small>
        )}
      </div>
      <div className="conn-item ok">
        <span className="conn-dot">🟢</span>
        <span>Supabase</span>
      </div>
    </div>
  );
}
