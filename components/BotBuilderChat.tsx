"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { BotBuilderMessage, BotSpec } from "@/lib/bot-builder/types";
import {
  AppShell, BottomSheet, Button, ChatBubble, Icon, IconButton, ProgressBar, Spinner, Toast, TopBar, useOnline, useSpeechInput,
} from "@/components/ui/primitives";
import type { PublicEvent, PublicProject } from "@/lib/builder/types";
import { SecureConnect } from "@/components/TelegramConnector";
import { BuildProgress, BuildSuccess, estimateEta, pipelineToBuild } from "@/components/BuildProgress";
import { botHref } from "@/components/BotProjects";

type Stage = "chat" | "connect" | "building" | "success" | "failed";
type ChatMessage = BotBuilderMessage & { at: number };

const GREETING = "ជម្រាបសួរ! តើអ្នកចង់បង្កើត Bot សម្រាប់អាជីវកម្មអ្វីដែរ? ប្រាប់ខ្ញុំជាភាសាធម្មតា ខ្ញុំនឹងសួរបន្ថែមតែចំណុចដែលចាំបាច់ប៉ុណ្ណោះ។";

/** The six things the requirements agent needs before it can build (03 sticky indicator). */
const KNOWN_POINTS = ["ឈ្មោះ & ប្រភេទអាជីវកម្ម", "ការពិពណ៌នាអំពីហាង", "មុខទំនិញ & តម្លៃ", "វិធីទូទាត់", "ភាសារបស់ Bot", "អ្នកទទួលការកុម្ម៉ង់"];

const PAYMENT_OPTIONS = [
  { icon: "qr" as const, title: "ABA KHQR ស្វ័យប្រវត្តិ 💳", sub: "ពិនិត្យផ្ទៀងផ្ទាត់វិក្កយបត្រភ្លាមៗ" },
  { icon: "receipt" as const, title: "ផ្ទេរប្រាក់ផ្ទាល់ (ផ្ញើវិក្កយបត្រ) 🧾", sub: "អតិថិជនផ្ញើរូបភាពបង្កាន់ដៃ" },
  { icon: "banknote" as const, title: "ទូទាត់ពេលដឹកដល់ (COD) 💵", sub: "ប្រមូលប្រាក់ផ្ទាល់ពេលទទួលទំនិញ" },
];

const SUGGESTIONS = ["✨ ពិនិត្យមើលលទ្ធផលគំរូ", "🚚 កំណត់ថ្លៃដឹកជញ្ជូន", "💬 សារស្វាគមន៍អតិថិជន"];

const BOT_TYPE_LABEL: Record<string, string> = { shop: "ហាងលក់ទំនិញ", chat: "ឆ្លើយសំណួរ 24/7", booking: "កក់ម៉ោង", miniapp: "Telegram Mini App" };
const PAYMENT_LABEL: Record<string, string> = { manual: "ផ្ទេរប្រាក់ផ្ទាល់ (ផ្ញើវិក្កយបត្រ)", external_link: "ABA KHQR / តំណទូទាត់", telegram_invoice: "វិក្កយបត្រ Telegram" };

const PAYMENT_TOPIC = /ទូទាត់|បង់ប្រាក់|គិតលុយ|payment|khqr|aba/i;
// Bot tokens (123456:ABC…) and long API-key-looking strings must never be sent through the chat.
const SECRET_LIKE = /\b\d{6,12}:[A-Za-z0-9_-]{30,}\b|\b(sk|pk|ghp|gho|xox[abp])[-_][A-Za-z0-9_-]{16,}/;

export function formatTimeKh(at: number): string {
  const d = new Date(at);
  const h = d.getHours();
  const part = h < 12 ? "ព្រឹក" : h < 18 ? "រសៀល" : "ល្ងាច";
  return `ម៉ោង ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${part}`;
}

function formatPrice(price: number, currency: "USD" | "KHR") {
  return currency === "KHR" ? `${price.toLocaleString("en-US")}៛` : `$${price.toFixed(2)}`;
}

/**
 * 03 Builder chat → 04 Secure connect → 05 Build progress → 06 Success.
 * The user describes the bot in everyday Khmer, the requirements agent asks
 * follow-ups (POST /api/bot-builder/chat). Confirming the spec creates a builder
 * project and starts the real pipeline (/api/builder/projects/:id/start); the
 * screens follow its SSE progress stream. `?project=<id>` resumes a build.
 */
export function BotBuilderChat() {
  const params = useSearchParams();
  const online = useOnline();
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: GREETING, at: Date.now() }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const [spec, setSpec] = useState<BotSpec | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("chat");
  const [project, setProject] = useState<PublicProject | null>(null);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [creating, setCreating] = useState(false);
  const streamRef = useRef<AbortController | null>(null);
  const lastEventId = useRef(0);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoSent = useRef(false);
  const voice = useSpeechInput((text) => setInput((v) => (v ? `${v} ${text}` : text)), setToast);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, spec]);

  // A prompt handed over from Home (/bot-builder?prompt=…) becomes the first message.
  useEffect(() => {
    const prompt = params.get("prompt");
    if (prompt && !autoSent.current) {
      autoSent.current = true;
      send(prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || loading) return;
    if (SECRET_LIKE.test(text)) {
      setError("សូមកុំបិទភ្ជាប់ Token ពាក្យសម្ងាត់ ឬកូនសោសម្ងាត់ក្នុងផ្ទាំងជជែក។ ការភ្ជាប់ Telegram ធ្វើឡើងដោយស្វ័យប្រវត្តិ ដោយចុចតែប៊ូតុងមួយ។");
      return;
    }
    if (raw === undefined) setInput("");
    setError(null);
    setLastFailed(null);
    const history: BotBuilderMessage[] = messages.map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: text, at: Date.now() }]);
    setLoading(true);
    try {
      const turn = await api.botBuilderChat(history, text);
      setMessages((m) => [...m, { role: "assistant", content: turn.reply, at: Date.now() }]);
      if (turn.done && turn.spec) setSpec(turn.spec);
    } catch (e: any) {
      setError(friendlyError(e));
      setLastFailed(text);
      setMessages((m) => m.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  /** Which screen a project state belongs to. */
  function stageFor(p: PublicProject): Stage {
    const run = p.run;
    if (!run) return "connect";
    if (run.status === "done" || p.status === "live") return "success";
    if (run.status === "failed") return "failed";
    if (run.status === "waiting" || ["requirements", "create_bot_link", "await_managed_bot"].includes(run.step)) return "connect";
    return "building";
  }

  function applyState(p: PublicProject) {
    setProject(p);
    if (p.spec) setSpec((cur) => cur ?? p.spec);
    setStage(stageFor(p));
  }

  /** Follows the SSE stream, reconnecting (from the last event id) until the run finishes. */
  function follow(projectId: string) {
    streamRef.current?.abort();
    const ctrl = new AbortController();
    streamRef.current = ctrl;
    let finished = false;
    const loop = async () => {
      while (!ctrl.signal.aborted && !finished) {
        try {
          await api.builderEvents(
            projectId,
            {
              onProgress: (e) => {
                lastEventId.current = Math.max(lastEventId.current, e.id);
                setEvents((list) => (list.some((x) => x.id === e.id) ? list : [...list, e]));
              },
              onState: (p) => {
                applyState(p);
                if (p.run && (p.run.status === "done" || p.run.status === "failed")) finished = true;
              },
            },
            ctrl.signal,
            lastEventId.current
          );
        } catch (e: any) {
          if (ctrl.signal.aborted) return;
          if (e?.status === 404 || e?.status === 403) { setError(friendlyError(e)); return; }
        }
        if (!finished && !ctrl.signal.aborted) await new Promise((r) => setTimeout(r, 2000));
      }
    };
    void loop();
  }

  useEffect(() => () => streamRef.current?.abort(), []);

  // Resume a build from My bots / Home (/bot-builder?project=<id>).
  useEffect(() => {
    const id = params.get("project");
    if (!id) return;
    api
      .builderGet(id)
      .then(({ project: p }) => {
        applyState(p);
        if (!p.run) api.builderStart(p.id).then(({ project: started }) => applyState(started)).catch((e) => setError(friendlyError(e)));
        follow(p.id);
      })
      .catch((e) => setError(friendlyError(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function confirmSpec() {
    if (!spec || creating) return;
    setCreating(true);
    setError(null);
    try {
      const { project: created } = await api.builderCreate(spec);
      setEvents([]);
      lastEventId.current = 0;
      const { project: started } = await api.builderStart(created.id);
      applyState(started);
      setStage("connect");
      follow(created.id);
    } catch (e: any) {
      setError(e?.data?.messageKh || friendlyError(e));
    } finally {
      setCreating(false);
    }
  }

  async function repair() {
    if (!project) return;
    try {
      await api.builderRepair(project.id);
      setStage("building");
      follow(project.id);
    } catch (e: any) {
      setToast(friendlyError(e));
    }
  }

  function restart() {
    streamRef.current?.abort();
    setMessages([{ role: "assistant", content: GREETING, at: Date.now() }]);
    setSpec(null);
    setPicked(null);
    setProject(null);
    setEvents([]);
    lastEventId.current = 0;
    setError(null);
    setStage("chat");
    setMenu(false);
  }

  const userTurns = messages.filter((m) => m.role === "user").length;
  const known = spec ? KNOWN_POINTS.length : Math.min(KNOWN_POINTS.length - 1, userTurns);
  const pct = Math.round((known / KNOWN_POINTS.length) * 100);
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const showPayments = !spec && !loading && userTurns > 0 && !!lastAssistant && PAYMENT_TOPIC.test(lastAssistant.content);

  const header = (
    <TopBar
      back={stage === "chat" ? "/" : undefined}
      title="Bot Editor"
      subtitle="TeleScripts Agent"
      actions={<>
        <IconButton label="ជម្រើស" onClick={() => setMenu(true)}><Icon name="more" size={22} /></IconButton>
        <Link href="/settings" className="ts-avatar-link" aria-label="គណនី"><span className="ui-avatar" style={{ width: 32, height: 32 }}><Icon name="person" size={18} /></span></Link>
      </>}
    />
  );

  const menuSheet = (
    <BottomSheet open={menu} title="ជម្រើស" onClose={() => setMenu(false)}>
      <Button block variant="secondary" icon="refresh" onClick={restart}>ចាប់ផ្តើមសន្ទនាថ្មី</Button>
      <Link href="/bot-builder/bots" className="ui-btn ui-secondary ui-md ui-block"><Icon name="bot" size={18} />Bot របស់ខ្ញុំ</Link>
    </BottomSheet>
  );

  if (stage === "connect") {
    return (
      <AppShell nav={false} className="ts-connect-shell">
        <SecureConnect
          link={project?.managedLink ?? null}
          botUsername={project?.suggestedUsername ? `@${project.suggestedUsername}` : null}
          linked={!!project?.bot?.linked}
          onBack={project ? undefined : () => setStage("chat")}
        />
        {error && <div className="ts-error" role="alert">{error}</div>}
        <Toast open={!!toast} message={toast} onClose={() => setToast(null)} />
      </AppShell>
    );
  }

  if ((stage === "building" || stage === "failed") && project) {
    const build = pipelineToBuild(events, project.run);
    return (
      <AppShell header={header} nav={false}>
        <BuildProgress state={build} etaSec={estimateEta(build)} onRepair={repair} />
        {menuSheet}
        <Toast open={!!toast} message={toast} onClose={() => setToast(null)} />
      </AppShell>
    );
  }

  if (stage === "success" && project) {
    return (
      <AppShell header={header} nav={false}>
        <BuildSuccess
          botName={project.name}
          botUsername={project.bot?.username ?? null}
          botUrl={project.bot?.url ?? null}
          miniAppUrl={project.bot?.miniAppUrl ?? null}
          logs={pipelineToBuild(events, project.run).logs}
          dashboardHref={botHref(project.id)}
          ownershipHref={botHref(project.id, "/ownership")}
          onAnother={restart}
        />
        {menuSheet}
      </AppShell>
    );
  }

  const footer = (
    <>
      <div className="ts-suggest" role="group" aria-label="សំណើ">
        {SUGGESTIONS.map((s) => <button key={s} type="button" className="ts-suggest-chip" onClick={() => send(s)} disabled={loading}>{s}</button>)}
      </div>
      <form className="ts-prompt-bar" onSubmit={(e) => { e.preventDefault(); send(); }}>
        {/* TODO(backend): product photos are not accepted by /api/bot-builder/chat yet. */}
        <IconButton label="បន្ថែមរូបភាពទំនិញ" onClick={() => setToast("ការបញ្ចូលរូបភាពទំនិញនឹងមកដល់ឆាប់ៗនេះ។")}><Icon name="camera" size={22} /></IconButton>
        <IconButton label="និយាយជាសំឡេង" onClick={voice.toggle} aria-pressed={voice.listening} className={voice.listening ? "ts-listening" : ""}><Icon name="mic" size={22} /></IconButton>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={voice.listening ? "កំពុងស្តាប់..." : "វាយបញ្ចូលចម្លើយរបស់អ្នកនៅទីនេះ..."}
          aria-label="វាយបញ្ចូលចម្លើយរបស់អ្នក"
          disabled={loading}
          autoComplete="off"
        />
        <button type="submit" className="ts-send-round" aria-label="ផ្ញើសារ" disabled={loading || !input.trim()}>{loading ? <Spinner size="sm" /> : <Icon name="arrowUp" size={20} />}</button>
      </form>
    </>
  );

  return (
    <AppShell header={header} nav={false} footer={footer} className="ts-chat-shell">
      <div className="ts-known">
        <div className="ts-known-card">
          <div className="ts-between">
            <span className="ts-row ts-known-title"><span className="ui-status-dot ui-dot-blue ui-pulse" />ចំណុចដែលបានដឹង {known}/{KNOWN_POINTS.length}</span>
            <span className="ts-micro ts-accent-text">{pct}% រួចរាល់</span>
          </div>
          <ProgressBar value={pct} label="ចំណុចដែលបានដឹង" />
          {/* TODO(backend): the requirements agent only returns the spec at the end; partial fields would make this exact. */}
          <div className="ts-between ts-micro ts-variant">
            <span className="ts-truncate">{KNOWN_POINTS[Math.max(0, known - 1)]}</span>
            {known > 0 && <Icon name="checkCircle" size={16} className="ts-success-text" />}
          </div>
        </div>
      </div>

      {!online && <div className="ts-error" role="alert"><Icon name="wifiOff" size={16} /> អ្នកកំពុងនៅក្រៅបណ្តាញ — សារនឹងផ្ញើបានពេលមានអ៊ីនធឺណិតវិញ។</div>}

      <div className="ts-thread" aria-live="polite">
        <div className="ts-day"><span>ថ្ងៃនេះ • ការរៀបចំ Bot</span></div>
        {messages.map((m, i) => (
          m.role === "user"
            ? <ChatBubble key={i} role="user" meta={formatTimeKh(m.at)}>{m.content}</ChatBubble>
            : (
              <ChatBubble key={i} role="assistant" meta={<>
                {i === 2 && <button type="button" className="ts-config-chip" onClick={() => send("ខ្ញុំចង់ប្តូរភាសារបស់ Bot")}><Icon name="languages" size={16} className="ui-accent" /><span>ភាសារបស់ Bot: <strong>ភាសាខ្មែរ 🇰🇭</strong> (ប្តូរបាន)</span></button>}
                {m === lastAssistant && showPayments && (
                  <div className="ts-options">
                    {PAYMENT_OPTIONS.map((o) => (
                      <button key={o.title} type="button" className={`ts-option${picked === o.title ? " picked" : ""}`} onClick={() => { setPicked(o.title); send(o.title); }}>
                        <span className="ts-option-icon"><Icon name={o.icon} size={20} /></span>
                        <span className="ts-option-text"><b>{o.title}</b><small>{o.sub}</small></span>
                        <Icon name={picked === o.title ? "checkCircle" : "plusCircle"} size={20} className="ts-option-mark" />
                      </button>
                    ))}
                  </div>
                )}
              </>}>
                {i === 2 && spec === null && userTurns > 0 && <span className="ts-recognized"><Icon name="verified" size={18} />ទទួលស្គាល់អាជីវកម្មរបស់អ្នក</span>}
                {m.content}
              </ChatBubble>
            )
        ))}

        {loading && (
          <div className="ui-msg ui-msg-ai">
            <span className="ui-msg-avatar"><Icon name="bot" size={18} /></span>
            <div className="ui-bubble ui-bubble-ai ts-typing" aria-label="AI កំពុងសរសេរ"><i /><i /><i /></div>
          </div>
        )}

        {spec && (
          <div className="ui-msg ui-msg-ai" style={{ maxWidth: "95%" }}>
            <span className="ui-msg-avatar"><Icon name="bot" size={18} /></span>
            <div className="ui-msg-col">
              <div className="ui-bubble ui-bubble-ai ts-stack" style={{ whiteSpace: "normal", gap: 12 }}>
                <p style={{ fontWeight: 500 }}>សូមពិនិត្យទិន្នន័យ Bot របស់អ្នកមុនពេលបង្កើត៖</p>
                <div className="ts-mini-form">
                  <div className="ts-between">
                    <span className="ts-row ts-mini-title"><Icon name="bot" size={18} className="ui-accent" />{spec.bot_name}</span>
                    <span className="ts-micro ts-variant">{BOT_TYPE_LABEL[spec.bot_type] || spec.bot_type}</span>
                  </div>
                  {(spec.products || []).length > 0 && (
                    <>
                      <div className="ts-between" style={{ paddingTop: 4 }}>
                        <span className="ts-row ts-mini-title"><Icon name="package" size={18} className="ui-accent" />ឈ្មោះមុខទំនិញ &amp; តម្លៃគំរូ</span>
                        <span className="ts-micro ts-variant">{(spec.products || []).length.toLocaleString("km-KH")} មុខបានបញ្ចូល</span>
                      </div>
                      {(spec.products || []).map((p, idx) => (
                        <div key={`${p.name}-${idx}`} className="ts-product">
                          <span className="ts-product-thumb"><Icon name="bag" size={18} /></span>
                          <span className="ts-product-text"><b>{p.name}</b><small>{formatPrice(p.price, p.currency)}</small></span>
                          <IconButton label="លុបមុខទំនិញ" onClick={() => setSpec({ ...spec, products: (spec.products || []).filter((_, j) => j !== idx) })}><Icon name="trash" size={18} /></IconButton>
                        </div>
                      ))}
                    </>
                  )}
                  {(spec.faq || []).length > 0 && <div className="ts-product"><span className="ts-product-thumb"><Icon name="message" size={18} /></span><span className="ts-product-text"><b>សំណួរ-ចម្លើយ</b><small>{(spec.faq || []).length.toLocaleString("km-KH")} សំណួរ</small></span></div>}
                  <div className="ts-product"><span className="ts-product-thumb"><Icon name="card" size={18} /></span><span className="ts-product-text"><b>វិធីទូទាត់</b><small>{PAYMENT_LABEL[spec.payment_method] || spec.payment_method}</small></span></div>
                  <button type="button" className="ts-add-item" onClick={() => { setInput("ខ្ញុំចង់បន្ថែមមុខទំនិញ៖ "); inputRef.current?.focus(); }}>
                    <Icon name="plusCircle" size={18} className="ui-accent" />+ បន្ថែមមុខទំនិញ
                  </button>
                </div>
              </div>
              <div className="ts-row" style={{ justifyContent: "flex-end" }}>
                <Button size="sm" trailingIcon="arrowRight" loading={creating} onClick={confirmSpec}>បញ្ជាក់ទិន្នន័យ</Button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="ts-error ts-between" role="alert">
            <span>{error}</span>
            {lastFailed && <Button size="sm" variant="secondary" icon="refresh" onClick={() => send(lastFailed)}>ព្យាយាមម្តងទៀត</Button>}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {menuSheet}
      <Toast open={!!toast} message={toast} onClose={() => setToast(null)} />
    </AppShell>
  );
}

/** Turns raw API errors into something a non-technical user can act on. */
export function friendlyError(e: any): string {
  const msg = e?.message || "";
  if (msg.includes("admin-only") || msg.includes("not enabled")) return "Bot Builder មិនទាន់បើកសម្រាប់គណនីនេះទេ។";
  if (msg.includes("quota") || msg.includes("limit")) return "អ្នកបានប្រើអស់កម្រិតថ្ងៃនេះហើយ។ សូមដំឡើងគម្រោង ឬព្យាយាមម្តងទៀតថ្ងៃស្អែក។";
  if (msg.includes("GitHub")) return "ប្រព័ន្ធរក្សាទុកកូដមិនទាន់រួចរាល់ (GitHub)។ សូមភ្ជាប់ GitHub នៅក្នុងការកំណត់ ឬទាក់ទងក្រុមការងារ។";
  if (msg.includes("No model") || msg.includes("model route")) return "ប្រព័ន្ធ AI មិនទាន់កំណត់រួចរាល់ទេ។ សូមទាក់ទងក្រុមការងារ។";
  if (msg === "Failed to fetch") return "មិនអាចភ្ជាប់ទៅ server បានទេ។ សូមពិនិត្យអ៊ីនធឺណិត ហើយព្យាយាមម្តងទៀត។";
  return msg || "មានបញ្ហា សូមព្យាយាមម្តងទៀត។";
}
