"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { TelegramStatus } from "@/lib/types";
import { Button, StatusBadge, BrandIcon } from "@/components/ui";

export const TELEGRAM_CHANGED_EVENT = "telegram-status-changed";

type UiState = "not_connected" | "connecting" | "connected" | "error" | "disconnected";

const BADGE: Record<UiState, "connected" | "disconnected" | "pending" | "error" | "idle"> = {
  not_connected: "idle",
  connecting: "pending",
  connected: "connected",
  error: "error",
  disconnected: "idle",
};

/**
 * Optional Telegram connector card (Settings -> Connectors / Integrations).
 * Nothing else in the app depends on it: failures here only affect this card.
 * The bot token lives on the server and is never requested, sent or shown here.
 */
export function TelegramConnector() {
  const { lang } = useLang();
  const kh = lang === "kh";
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [busy, setBusy] = useState<null | "connect" | "test" | "disconnect">(null);
  const [flowOpen, setFlowOpen] = useState(false);
  const [chatId, setChatId] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const apply = useCallback((s: TelegramStatus) => {
    setStatus(s);
    window.dispatchEvent(new CustomEvent(TELEGRAM_CHANGED_EVENT, { detail: s }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.telegramStatus());
    } catch {
      // Optional connector: stay quiet and show "not connected".
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const state: UiState = busy === "connect" ? "connecting" : status?.state ?? "not_connected";
  const connected = state === "connected";

  const labels: Record<UiState, string> = {
    not_connected: kh ? "មិនបានតភ្ជាប់" : "Not connected",
    connecting: kh ? "កំពុងតភ្ជាប់…" : "Connecting…",
    connected: kh ? "បានតភ្ជាប់" : "Connected",
    error: kh ? "កំហុសក្នុងការតភ្ជាប់" : "Connection error",
    disconnected: kh ? "បានផ្តាច់" : "Disconnected",
  };

  async function connect() {
    setBusy("connect");
    setMessage(null);
    try {
      const s = await api.telegramConnect(chatId.trim());
      apply(s);
      setFlowOpen(false);
      setChatId("");
      setMessage({ kind: "ok", text: kh ? "បានផ្ទៀងផ្ទាត់ និងតភ្ជាប់ Telegram។" : "Telegram verified and connected." });
    } catch (e: any) {
      setMessage({ kind: "error", text: e?.message || "Connection failed" });
      await refresh(); // pick up the stored "error" state
      window.dispatchEvent(new CustomEvent(TELEGRAM_CHANGED_EVENT));
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    setMessage(null);
    try {
      const s = await api.telegramTest();
      apply(s);
      setMessage({
        kind: "ok",
        text: s.sentToChat
          ? kh ? "តេស្តជោគជ័យ — បានផ្ញើសារទៅ chat។" : "Test passed — a message was sent to your chat."
          : kh ? "តេស្តជោគជ័យ — bot ឆ្លើយតប។" : "Test passed — the bot responded.",
      });
    } catch (e: any) {
      setMessage({ kind: "error", text: e?.message || "Test failed" });
      await refresh();
      window.dispatchEvent(new CustomEvent(TELEGRAM_CHANGED_EVENT));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    setMessage(null);
    try {
      apply(await api.telegramDisconnect());
      setMessage({ kind: "ok", text: kh ? "បានផ្តាច់ Telegram។" : "Telegram disconnected." });
    } catch (e: any) {
      setMessage({ kind: "error", text: e?.message || "Disconnect failed" });
    } finally {
      setBusy(null);
    }
  }

  const canTest = state === "connected" || state === "error";
  const canDisconnect = state === "connected" || state === "error";
  const working = busy !== null;

  return (
    <div className="connector-card">
      <div className="connector-head">
        <div className="connector-title">
          <BrandIcon name="telegram" size={28} />
          <strong>Telegram</strong>
          <small className="connector-optional">{kh ? "ជម្រើស (Optional)" : "Optional"}</small>
        </div>
        <StatusBadge status={BADGE[state]} label={labels[state]} />
      </div>

      {state === "not_connected" || state === "disconnected" ? (
        <p>{kh ? "Telegram មិនបានតភ្ជាប់ — Claude Code ដំណើរការធម្មតា។" : "Telegram not connected — Claude Code works normally without it."}</p>
      ) : null}

      {connected && status?.bot && (
        <p>
          {kh ? "Bot" : "Bot"}: <strong>{status.bot.username ? `@${status.bot.username}` : status.bot.name}</strong>
          {status.chat && (
            <>
              {" · "}
              {kh ? "Chat" : "Chat"}: <strong>{status.chat.title || status.chat.id}</strong>
            </>
          )}
        </p>
      )}
      {status?.lastCheckedAt && (state === "connected" || state === "error") && (
        <p className="connector-meta">
          {kh ? "ពិនិត្យចុងក្រោយ" : "Last checked"}: {new Date(status.lastCheckedAt).toLocaleString()}
        </p>
      )}
      {state === "error" && status?.lastError && (
        <p className="connector-error">{status.lastError}</p>
      )}
      {status?.unavailable && (
        <p className="connector-meta">
          {kh
            ? "មិនអាចអានស្ថានភាព Telegram បានទេ (ប្រហែលជាមិនទាន់ run migration)។"
            : "Telegram status is unavailable (the telegram_connections migration may not be applied)."}
        </p>
      )}

      <div className="connector-actions">
        <Button className="btn-sm" onClick={() => { setFlowOpen(true); setMessage(null); refresh(); }} disabled={working || connected}>
          {kh ? "តភ្ជាប់ Telegram" : "Connect Telegram"}
        </Button>
        <Button variant="secondary" className="btn-sm" onClick={test} disabled={working || !canTest}>
          {busy === "test" ? (kh ? "កំពុងតេស្ត…" : "Testing…") : kh ? "តេស្តការតភ្ជាប់" : "Test Connection"}
        </Button>
        <Button variant="danger" className="btn-sm" onClick={disconnect} disabled={working || !canDisconnect}>
          {kh ? "ផ្តាច់" : "Disconnect"}
        </Button>
      </div>

      {message && (
        <p className={message.kind === "error" ? "connector-error" : "connector-ok"}>{message.text}</p>
      )}

      {flowOpen && !connected && (
        <div className="setup-box">
          {status && !status.configured ? (
            <>
              <p>
                <strong>{kh ? "ជំហានដំឡើង" : "Setup required"}</strong>
              </p>
              <p>
                1. {kh ? "បើក" : "Open"}{" "}
                <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">@BotFather</a>{" "}
                {kh ? "ហើយបង្កើត bot ដោយប្រើ /newbot។" : "in Telegram and create a bot with /newbot."}
              </p>
              <p>
                2. {kh ? "កំណត់" : "Set"} <code>TELEGRAM_BOT_TOKEN</code>{" "}
                {kh ? "ជា environment variable លើ server (មិនដាក់ក្នុង code ឬ browser)។" : "as a server environment variable (never in code or the browser)."}
              </p>
              <p>3. {kh ? "Redeploy/restart server រួចចុច Re-check។" : "Restart/redeploy the server, then click Re-check."}</p>
              <div className="connector-actions">
                <Button variant="secondary" className="btn-sm" onClick={refresh} disabled={working}>
                  Re-check
                </Button>
                <Button variant="ghost" className="btn-sm" onClick={() => setFlowOpen(false)}>
                  {kh ? "បោះបង់" : "Cancel"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p>
                {kh
                  ? "Server នឹងផ្ទៀងផ្ទាត់ bot token របស់វាជាមួយ Telegram។ token មិនត្រូវបានផ្ញើទៅ browser ទេ។"
                  : "The server will verify its bot token with Telegram. The token is never sent to your browser."}
              </p>
              <p>
                {kh
                  ? "(ជម្រើស) Chat ID សម្រាប់ទទួលសារ — ផ្ញើ /start ទៅ bot របស់អ្នកជាមុន:"
                  : "(Optional) Chat ID to receive messages — send /start to your bot first:"}
              </p>
              <input
                className="connector-input"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="123456789  or  -1001234567890  or  @channelname"
                disabled={working}
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
              />
              <div className="connector-actions">
                <Button className="btn-sm" onClick={connect} disabled={working || !status}>
                  {busy === "connect" ? (kh ? "កំពុងផ្ទៀងផ្ទាត់…" : "Verifying…") : kh ? "ផ្ទៀងផ្ទាត់ & តភ្ជាប់" : "Verify & connect"}
                </Button>
                <Button variant="ghost" className="btn-sm" onClick={() => setFlowOpen(false)} disabled={working}>
                  {kh ? "បោះបង់" : "Cancel"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
