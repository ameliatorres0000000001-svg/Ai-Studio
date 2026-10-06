"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { BrandIcon } from "@/components/ui";
import type { TelegramStatus } from "@/lib/types";
import { TELEGRAM_CHANGED_EVENT } from "@/components/TelegramConnector";

interface ConnState {
  configured: boolean;
  username?: string;
  setupRequired?: boolean;
  envVars?: string[];
}

export function ConnectionStatus() {
  const { t, lang } = useLang();
  const [github, setGithub] = useState<ConnState | null>(null);
  const [claude, setClaude] = useState<ConnState | null>(null);
  const [supabase, setSupabase] = useState<boolean | null>(null);
  const [telegram, setTelegram] = useState<TelegramStatus | null>(null);

  // Optional connector: any failure just means "Telegram not connected".
  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .telegramStatus()
        .then((s) => alive && setTelegram(s))
        .catch(() => alive && setTelegram(null));
    load();
    window.addEventListener(TELEGRAM_CHANGED_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(TELEGRAM_CHANGED_EVENT, load);
    };
  }, []);

  useEffect(() => {
    async function check() {
      try {
        const gh = await api.githubStatus();
        setGithub(gh);
      } catch {
        setGithub({ configured: false });
      }
      try {
        const h = await api.health();
        setClaude({ configured: h.claude });
        setSupabase(h.supabase);
      } catch {
        setClaude({ configured: false });
        setSupabase(false);
      }
    }
    check();
  }, []);

  return (
    <div className="connection-status">
      <div className={`conn-item ${github?.configured ? "ok" : "warn"}`}>
        <span className="conn-dot" />
        <span className="brand-icon-slot" />
        <span>GitHub</span>
        {github?.configured && github.username && <small>{github.username}</small>}
        {!github?.configured && (
          <small>{lang === "kh" ? "មិនបានកំណត់" : "Not set"}</small>
        )}
      </div>
      <div className={`conn-item ${claude?.configured ? "ok" : "warn"}`}>
        <span className="conn-dot" />
        <BrandIcon name="claude" size={16} />
        <span>Claude Code</span>
        {!claude?.configured && (
          <small>{lang === "kh" ? "មិនបានកំណត់" : "Not set"}</small>
        )}
      </div>
      <div className={`conn-item ${supabase ? "ok" : "warn"}`}>
        <span className="conn-dot" />
        <BrandIcon name="supabase" size={16} />
        <span>Supabase</span>
      </div>
      <div
        className={`conn-item ${
          telegram?.state === "connected" ? "ok" : telegram?.state === "error" ? "warn" : "off"
        }`}
      >
        <span className="conn-dot" />
        <BrandIcon name="telegram" size={16} />
        <span>Telegram</span>
        <small>
          {telegram?.state === "connected"
            ? telegram.bot?.username
              ? `@${telegram.bot.username}`
              : lang === "kh" ? "បានតភ្ជាប់" : "connected"
            : telegram?.state === "error"
              ? lang === "kh" ? "កំហុស" : "error"
              : lang === "kh" ? "មិនបានតភ្ជាប់" : "not connected"}
        </small>
      </div>
    </div>
  );
}
