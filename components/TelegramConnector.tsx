"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { TelegramStatus } from "@/lib/types";
import { BrandIcon } from "@/components/ui";
import { Badge, BottomSheet, Button, Card, Field, Icon, Input, type Tone } from "@/components/ui/primitives";

export const TELEGRAM_CHANGED_EVENT = "telegram-status-changed";

/**
 * 04 Secure connect — reassuring 3-step Telegram deep link (Managed Bots). The
 * link is generated server-side: https://t.me/newbot/{manager}/{username}?name=…
 * The user only taps "Allow" in Telegram; the bot is created for them and the
 * platform receives its token directly from Telegram. The UI never asks for a
 * token, password or key. The screen moves on by itself once the bot is linked.
 */
export function SecureConnect({ link, botUsername, linked, onBack }: { link: string | null; botUsername: string | null; linked: boolean; onBack?: () => void }) {
  const [sheet, setSheet] = useState(false);

  function openTelegram() {
    if (!link) return;
    window.open(link, "_blank", "noopener,noreferrer");
    setSheet(true);
  }

  const handle = botUsername || "Bot ថ្មីរបស់អ្នក";
  return (
    <div className="ts-connect">
      <section className="ts-connect-hero">
        <span className="ts-connect-shield"><Icon name="shield" size={36} /></span>
        <span className="ts-pill ts-pill-success"><span className="ui-status-dot ui-dot-green" />TeleScripts Instant Shield</span>
        <h2>ការភ្ជាប់ Telegram ដោយសុវត្ថិភាព</h2>
        <p>បង្កើតនិងភ្ជាប់ Bot អាជីវកម្មរបស់អ្នកដោយចុចតែម្តងគត់ ដោយគ្មានភាពស្មុគស្មាញ។</p>
      </section>

      <div className="ts-secure">
        <span className="ts-secure-icon"><Icon name="lock" size={20} /></span>
        <div>
          <strong>សុវត្ថិភាព 100% មិនប៉ះពាល់ទិន្នន័យ</strong>
          <p>ពាក្យសម្ងាត់ និងកូនសោសម្ងាត់មិនត្រូវបានបង្ហាញដល់ AI ឬភាគីទីបីឡើយ។ គ្មានការស្នើសុំលេខកូដសម្ងាត់ ឬ BotFather Token ក្នុងផ្ទាំងជជែកឡើយ។</p>
        </div>
      </div>

      <section className="ts-stack" style={{ gap: 14 }}>
        <div className="ts-between" style={{ padding: "0 4px" }}>
          <span className="ts-connect-steps-title">ដំណើរការរហ័ស ៣ ជំហាន</span>
          <span className="ts-pill ts-pill-accent" style={{ alignSelf: "auto" }}>សាមញ្ញ &amp; ស្វ័យប្រវត្តិ</span>
        </div>
        <div className="ts-connect-step">
          <span className="ts-step-num active">1</span>
          <div><h3>ជំហានទី 1</h3><p>ចុចប៊ូតុង <b className="ts-accent-text">&quot;ភ្ជាប់ទៅកាន់ Telegram&quot;</b> ខាងក្រោមនេះ ដើម្បីបើកដំណើរការភ្លាមៗ។</p></div>
        </div>
        <div className="ts-connect-step">
          <span className="ts-step-num">2</span>
          <div><h3>ជំហានទី 2</h3><p>Telegram នឹងបើកឡើង ហើយសួរអ្នកដើម្បីអនុញ្ញាតបង្កើត bot ឈ្មោះ <span className="ts-handle-chip">{handle}</span></p></div>
        </div>
        <div className="ts-connect-step">
          <span className={`ts-step-num${linked ? " active" : ""}`}>3</span>
          <div><h3>ជំហានទី 3</h3><p>ចុច <b className="ts-success-text">&quot;អនុញ្ញាត (Allow)&quot;</b> ក្នុង Telegram ហើយប្រព័ន្ធនឹងភ្ជាប់ដោយស្វ័យប្រវត្តិតែម្តង។</p></div>
        </div>
      </section>

      <div className="ts-hint ts-hint-plain">
        <span className="ts-tile ts-tile-sm" style={{ background: "var(--color-surface-high)", color: "var(--color-text-variant)" }}><Icon name="verified" size={18} /></span>
        <p>មិនចាំបាច់មានចំណេះដឹងកូដ មិនចាំបាច់រៀបចំ Server ឬបង្កើត BotFather ដោយដៃឡើយ។</p>
      </div>

      <div className="ts-stack" style={{ gap: 12 }}>
        <button type="button" className="ts-tg-cta" onClick={openTelegram} disabled={!link} aria-busy={!link}>
          {link ? <Icon name="send" size={20} /> : <span className="ui-spinner ui-spinner-sm" aria-hidden="true" />}
          <span>{link ? "ភ្ជាប់ទៅកាន់ Telegram ដោយចុចតែម្តង ✈️" : "កំពុងរៀបចំតំណ..."}</span>
        </button>
        <div className="ts-help-row">
          <Icon name="headset" size={18} />
          <span>ត្រូវការជំនួយពីអ្នកជំនាញ?</span>
          <Link href="/help">ជជែកជាមួយក្រុមការងារ</Link>
        </div>
        {onBack && <Button variant="ghost" size="sm" icon="arrowLeft" onClick={onBack}>ត្រឡប់ទៅកែទិន្នន័យ</Button>}
      </div>

      <BottomSheet open={sheet && !linked} onClose={() => setSheet(false)}>
        <span className="ts-tile ts-tile-success ts-tile-round"><Icon name="lock" size={26} className="ui-pulse" /></span>
        <h3 className="ui-sheet-title">កំពុងបញ្ជូនទៅកាន់ Telegram...</h3>
        <p className="ts-small ts-variant" style={{ marginBottom: 8 }}>សូមចុច &quot;Allow&quot; នៅលើផ្ទាំង Telegram ផ្លូវការ ដើម្បីបញ្ចប់ការភ្ជាប់ bot {handle} របស់អ្នក។ អេក្រង់នេះនឹងបន្តដោយស្វ័យប្រវត្តិ។</p>
        <Button block variant="secondary" onClick={() => setSheet(false)}>យល់ព្រម</Button>
        {link && <a className="ts-link" href={link} target="_blank" rel="noopener noreferrer">បើក Telegram ម្តងទៀត</a>}
      </BottomSheet>
    </div>
  );
}

/* ── Settings → Connectors card (workspace notifications bot) ─────────────── */

type UiState = "not_connected" | "connecting" | "connected" | "error" | "disconnected";

const TONE: Record<UiState, Tone> = {
  not_connected: "neutral",
  connecting: "blue",
  connected: "green",
  error: "red",
  disconnected: "neutral",
};

const LABELS: Record<UiState, string> = {
  not_connected: "មិនបានតភ្ជាប់",
  connecting: "កំពុងតភ្ជាប់…",
  connected: "បានតភ្ជាប់",
  error: "កំហុសក្នុងការតភ្ជាប់",
  disconnected: "បានផ្តាច់",
};

/**
 * Optional Telegram connector card (Settings -> Connectors / Integrations).
 * Nothing else in the app depends on it: failures here only affect this card.
 * The bot token lives on the server and is never requested, sent or shown here.
 */
export function TelegramConnector() {
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

  async function connect() {
    setBusy("connect");
    setMessage(null);
    try {
      const s = await api.telegramConnect(chatId.trim());
      apply(s);
      setFlowOpen(false);
      setChatId("");
      setMessage({ kind: "ok", text: "បានផ្ទៀងផ្ទាត់ និងតភ្ជាប់ Telegram។" });
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
      setMessage({ kind: "ok", text: s.sentToChat ? "តេស្តជោគជ័យ — បានផ្ញើសារទៅ chat។" : "តេស្តជោគជ័យ — bot ឆ្លើយតប។" });
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
      setMessage({ kind: "ok", text: "បានផ្តាច់ Telegram។" });
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
    <Card className="ts-stack">
      <div className="ts-between">
        <div className="ts-row">
          <BrandIcon name="telegram" size={28} />
          <strong>Telegram</strong>
          <span className="ts-micro ts-muted">ជម្រើស (Optional)</span>
        </div>
        <Badge tone={TONE[state]} dot>{LABELS[state]}</Badge>
      </div>

      {(state === "not_connected" || state === "disconnected") && <p className="ts-small ts-muted">Telegram មិនបានតភ្ជាប់ — កម្មវិធីដំណើរការធម្មតា។</p>}

      {connected && status?.bot && (
        <p className="ts-small">
          Bot: <strong>{status.bot.username ? `@${status.bot.username}` : status.bot.name}</strong>
          {status.chat && <>{" · "}Chat: <strong>{status.chat.title || status.chat.id}</strong></>}
        </p>
      )}
      {status?.lastCheckedAt && (state === "connected" || state === "error") && (
        <p className="ts-small ts-muted">ពិនិត្យចុងក្រោយ: {new Date(status.lastCheckedAt).toLocaleString("km-KH")}</p>
      )}
      {state === "error" && status?.lastError && <p className="ts-error">{status.lastError}</p>}
      {status?.unavailable && <p className="ts-small ts-muted">មិនអាចអានស្ថានភាព Telegram បានទេ (ប្រហែលជាមិនទាន់ run migration)។</p>}

      <div className="ts-row" style={{ flexWrap: "wrap" }}>
        <Button size="sm" onClick={() => { setFlowOpen(true); setMessage(null); refresh(); }} disabled={working || connected}>តភ្ជាប់ Telegram</Button>
        <Button size="sm" variant="secondary" onClick={test} disabled={working || !canTest} loading={busy === "test"}>តេស្តការតភ្ជាប់</Button>
        <Button size="sm" variant="danger" onClick={disconnect} disabled={working || !canDisconnect}>ផ្តាច់</Button>
      </div>

      {message && <p className={message.kind === "error" ? "ts-error" : "ts-notice"}>{message.text}</p>}

      {flowOpen && !connected && (
        <Card tone="tint" className="ts-stack">
          {status && !status.configured ? (
            <>
              <strong>ជំហានដំឡើង (សម្រាប់អ្នកគ្រប់គ្រង server)</strong>
              <p className="ts-small">1. បើក <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">@BotFather</a> ហើយបង្កើត bot ដោយប្រើ /newbot។</p>
              <p className="ts-small">2. កំណត់ <code>TELEGRAM_BOT_TOKEN</code> ជា environment variable លើ server (មិនដាក់ក្នុង code, browser ឬផ្ទាំងជជែក)។</p>
              <p className="ts-small">3. Restart server រួចចុច &quot;ពិនិត្យម្តងទៀត&quot;។</p>
              <div className="ts-row">
                <Button size="sm" variant="secondary" onClick={refresh} disabled={working}>ពិនិត្យម្តងទៀត</Button>
                <Button size="sm" variant="ghost" onClick={() => setFlowOpen(false)}>បោះបង់</Button>
              </div>
            </>
          ) : (
            <>
              <p className="ts-small">Server នឹងផ្ទៀងផ្ទាត់ bot token របស់វាជាមួយ Telegram។ token មិនត្រូវបានផ្ញើទៅ browser ទេ។</p>
              <Field label="(ជម្រើស) Chat ID សម្រាប់ទទួលសារ" hint="ផ្ញើ /start ទៅ bot របស់អ្នកជាមុនសិន">
                <Input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="123456789  ឬ  -1001234567890  ឬ  @channelname" disabled={working} inputMode="text" autoComplete="off" spellCheck={false} />
              </Field>
              <div className="ts-row">
                <Button size="sm" onClick={connect} disabled={working || !status} loading={busy === "connect"}>ផ្ទៀងផ្ទាត់ &amp; តភ្ជាប់</Button>
                <Button size="sm" variant="ghost" onClick={() => setFlowOpen(false)} disabled={working}>បោះបង់</Button>
              </div>
            </>
          )}
        </Card>
      )}
    </Card>
  );
}
