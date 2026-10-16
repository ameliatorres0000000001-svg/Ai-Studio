"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PublicProject } from "@/lib/builder/types";
import {
  AppShell, Badge, Button, ButtonLink, Card, Icon, ListSkeleton, SectionHeader, StateView, Tabs, Textarea, Toast, TopBar,
} from "@/components/ui/primitives";
import { BotConfigEditor, FaqConfigEditor, botHref, statusBadge, timeAgoKh } from "@/components/BotProjects";

const TABS = [
  { id: "orders", label: "ទិន្នន័យ" },
  { id: "settings", label: "ការកំណត់" },
  { id: "logs", label: "កំណត់ត្រា" },
  { id: "ai", label: "ជំនួយពី AI" },
];

const ORDER_BADGE: Record<string, { tone: "blue" | "green" | "neutral" | "red"; label: string }> = {
  new: { tone: "blue", label: "ថ្មី" },
  paid: { tone: "green", label: "បានទូទាត់" },
  shipped: { tone: "neutral", label: "បានដឹកជញ្ជូន" },
  cancelled: { tone: "red", label: "បានបោះបង់" },
};

const AI_SUGGESTIONS = ["បន្ថែមមុខទំនិញថ្មី", "ប្តូរសារស្វាគមន៍", "បន្ថែមថ្លៃដឹកជញ្ជូន", "បន្ថែមការបញ្ចុះតម្លៃ ១០%"];

type BotData = Awaited<ReturnType<typeof api.builderData>>;

function formatAmount(amount: number | null, currency: string | null) {
  if (amount == null) return "—";
  return currency === "KHR" ? `${Number(amount).toLocaleString("en-US")}៛` : `$${Number(amount).toFixed(2)}`;
}

/** Loads a project + its dashboard data with every async state covered. */
function useProject(projectId: string) {
  const [project, setProject] = useState<PublicProject | null>(null);
  const [data, setData] = useState<BotData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const load = useCallback(() => {
    setState("loading");
    Promise.all([api.builderGet(projectId), api.builderData(projectId)])
      .then(([p, d]) => { setProject(p.project); setData(d); setState("ready"); })
      .catch(() => setState("error"));
  }, [projectId]);
  useEffect(load, [load]);
  return { project, data, state, reload: load };
}

/** 08 Bot detail — orders, settings (config editor → redeploy), build log, "ប្រាប់ AI ឲ្យកែ". */
export function BotDetail({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState("orders");
  const [toast, setToast] = useState<string | null>(null);
  const { project, data, state, reload } = useProject(projectId);

  if (state === "loading") return <AppShell header={<TopBar back="/bot-builder/bots" title="Bot" />}><ListSkeleton rows={3} /></AppShell>;
  if (state === "error" || !project || !data) return <AppShell header={<TopBar back="/bot-builder/bots" title="Bot" />}><StateView kind="error" onRetry={reload} /></AppShell>;

  const badge = statusBadge(project.status);
  const handle = project.bot?.username ? `@${project.bot.username}` : project.template === "faq-bot" ? "ឆ្លើយសំណួរ 24/7" : "ហាងលក់ទំនិញ";

  async function repair() {
    try {
      await api.builderRepair(projectId);
      setToast("កំពុងជួសជុល — AI ចាប់ផ្តើមឡើងវិញពីជំហានដែលបរាជ័យ។");
      setTimeout(reload, 1500);
    } catch (e: any) {
      setToast(e?.message || "មិនអាចជួសជុលបានទេ។");
    }
  }

  return (
    <AppShell header={<TopBar back="/bot-builder/bots" title={project.name} subtitle={handle} actions={<Link href={botHref(projectId, "/ownership")} className="ui-icon-btn ui-icon-plain" aria-label="កម្មសិទ្ធិ"><Icon name="shield" size={22} /></Link>} />}>
      <section className="ts-bot-card">
        <div className="ts-between" style={{ alignItems: "flex-start" }}>
          <div className="ts-row" style={{ gap: 8 }}>
            <span className="ts-tile ts-tile-accent"><Icon name={project.template === "faq-bot" ? "message" : "bot"} size={26} /></span>
            <div style={{ minWidth: 0 }}>
              <h3>{project.name}</h3>
              <p className="ts-handle">{handle}</p>
            </div>
          </div>
          <Badge tone={badge.tone} dot pulse={project.status === "live"}>{badge.label}</Badge>
        </div>
        <div className="ts-metrics" style={{ marginTop: 4 }}>
          <div className="ts-metric ts-metric-flat"><b>{data.ordersToday}</b><span>កុម្ម៉ង់ថ្ងៃនេះ</span></div>
          <div className="ts-metric ts-metric-flat"><b>{data.customers}</b><span>អតិថិជន</span></div>
          <div className="ts-metric ts-metric-flat"><b>{data.products}</b><span>មុខទំនិញ</span></div>
        </div>
        {project.bot?.username && project.status === "live" && (
          <div className="ts-row" style={{ flexWrap: "wrap", paddingTop: 4 }}>
            <ButtonLink href={`https://t.me/${encodeURIComponent(project.bot.username)}`} external size="sm" icon="send">បើក bot ក្នុង Telegram</ButtonLink>
          </div>
        )}
      </section>

      {project.status === "failed" && (
        <div className="ts-error ts-between" role="alert">
          <span>{project.run?.error || "ការបង្កើតបានជួបបញ្ហា"}</span>
          <Button size="sm" variant="secondary" icon="wrench" onClick={repair}>ឲ្យ AI ជួសជុល</Button>
        </div>
      )}
      {(project.status === "building" || project.status === "waiting_bot" || project.status === "draft") && (
        <div className="ts-notice ts-between">
          <span>Bot នេះកំពុងបង្កើត។</span>
          <ButtonLink href={`/bot-builder?project=${encodeURIComponent(projectId)}`} size="sm" variant="secondary" trailingIcon="arrowRight">បន្តបង្កើត</ButtonLink>
        </div>
      )}

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "orders" && <OrdersTab data={data} />}
      {/* Kept mounted so unsaved edits survive tab switches. */}
      <div hidden={tab !== "settings"}>{project.template === "faq-bot" ? <FaqConfigEditor projectId={projectId} /> : <BotConfigEditor projectId={projectId} />}</div>
      {tab === "logs" && <LogsTab data={data} />}
      {tab === "ai" && <AiTab projectId={projectId} live={project.status === "live"} />}

      <Link href={botHref(projectId, "/ownership")} className="ts-own-card">
        <span className="ts-secure-icon"><Icon name="verified" size={20} /></span>
        <span><strong>កម្មសិទ្ធិ & ការនាំចេញ</strong><small>Bot និងទិន្នន័យអតិថិជន ជាកម្មសិទ្ធិរបស់អ្នក។</small></span>
        <Icon name="chevronRight" size={18} />
      </Link>
      <Toast open={!!toast} message={toast} onClose={() => setToast(null)} />
    </AppShell>
  );
}

function OrdersTab({ data }: { data: BotData }) {
  if (!data.orders.length) {
    return <StateView kind="empty" icon="bag" title="មិនទាន់មានការកុម្ម៉ង់ទេ" description="ការកុម្ម៉ង់ពីអតិថិជនក្នុង Telegram នឹងបង្ហាញនៅទីនេះភ្លាមៗ។" />;
  }
  return (
    <section className="ts-stack">
      <SectionHeader icon="bag" title="ការកុម្ម៉ង់ថ្មីៗ" />
      {data.orders.map((o) => {
        const b = ORDER_BADGE[o.status] || ORDER_BADGE.new;
        return (
          <div key={o.id} className="ts-order">
            <span className="ts-tile ts-tile-sm ts-tile-tint"><Icon name="receipt" size={18} /></span>
            <div className="ts-order-text">
              <div className="ts-between"><b className="ts-truncate">{o.product}</b><span className="ts-order-total">{formatAmount(o.amount, o.currency)}</span></div>
              <div className="ts-between ts-small ts-variant"><span className="ts-truncate">{timeAgoKh(o.created_at)}</span><Badge tone={b.tone}>{b.label}</Badge></div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function LogsTab({ data }: { data: BotData }) {
  if (!data.events.length) return <StateView kind="empty" icon="history" title="មិនទាន់មានកំណត់ត្រាទេ" description="ជំហាននៃការបង្កើត និងការដាក់ឲ្យដំណើរការ នឹងបង្ហាញនៅទីនេះ។" />;
  return (
    <section className="ts-stack">
      <SectionHeader icon="history" title="កំណត់ត្រាការបង្កើត & Deploy" />
      <div className="ts-code">
        {data.events.map((e) => (
          <div key={e.id} className={e.status === "done" ? "ok" : e.status === "failed" ? "err" : e.status === "waiting" ? "wait" : "run"}>
            <span>{e.status === "done" ? "✓" : e.status === "failed" ? "✕" : e.status === "retry" ? "↻" : "→"}</span>
            <span>{timeAgoKh(e.created_at)} — {e.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AiTab({ projectId, live }: { projectId: string; live: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<{ text: string; actions: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.builderAgent(projectId, text.trim());
      setReply({ text: r.reply, actions: r.actions });
      setText("");
    } catch (e: any) {
      setError(e?.data?.messageKh || e?.message || "មិនអាចផ្ញើទៅ AI បានទេ។");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ts-stack">
      <Card className="ts-stack">
        <div className="ts-row"><span className="ts-tile ts-tile-sm ts-tile-solid"><Icon name="sparkles" size={18} /></span><strong>ប្រាប់ AI ឲ្យកែ</strong></div>
        <p className="ts-small ts-variant">ពិពណ៌នាការផ្លាស់ប្តូរជាភាសាធម្មតា AI នឹងកែការកំណត់ Bot ហើយដាក់ឲ្យដំណើរការឡើងវិញដោយស្វ័យប្រវត្តិ។</p>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="ឧទាហរណ៍៖ បន្ថែមមុខទំនិញ 'កាបូបស្បែក' តម្លៃ $25" aria-label="ប្រាប់ AI ឲ្យកែ" />
        <div className="ts-suggest">{AI_SUGGESTIONS.map((s) => <button key={s} type="button" className="ts-suggest-chip" onClick={() => setText(s)}>{s}</button>)}</div>
        {!live && <p className="ts-small ts-muted">AI អាចកែបាន បន្ទាប់ពី Bot ដំណើរការរួចរាល់។</p>}
        <div className="ts-row" style={{ justifyContent: "flex-end" }}>
          <Button size="sm" trailingIcon="arrowUp" loading={busy} disabled={!text.trim() || !live} onClick={send}>ផ្ញើទៅ AI</Button>
        </div>
      </Card>
      {error && <div className="ts-error" role="alert">{error}</div>}
      {reply && (
        <Card tone="tint" className="ts-stack">
          <p style={{ whiteSpace: "pre-wrap" }}>{reply.text}</p>
          {reply.actions.length > 0 && <ul className="ts-steps-list">{reply.actions.map((a, i) => <li key={i}>{a}</li>)}</ul>}
        </Card>
      )}
    </section>
  );
}

/** Bots generated before the platform pipeline live in the user's own GitHub; only their catalogue is editable here. */
export function LegacyBotDetail({ repo }: { repo: string }) {
  return (
    <AppShell header={<TopBar back="/bot-builder/bots" title={repo.split("/")[1] || repo} subtitle={repo} />}>
      <SectionHeader icon="sliders" title="ការកំណត់" />
      <BotConfigEditor repo={repo} />
    </AppShell>
  );
}

/* ── 09 Ownership ─────────────────────────────────────────────────────────── */

/** 09 Ownership & export guarantee: the Telegram bot is the user's (Managed Bots); the data is exportable. */
export function Ownership({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<PublicProject | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [toast, setToast] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const load = useCallback(() => {
    setState("loading");
    api.builderGet(projectId).then(({ project }) => { setProject(project); setState("ready"); }).catch(() => setState("error"));
  }, [projectId]);
  useEffect(load, [load]);

  async function exportCsv() {
    setExporting(true);
    try {
      const blob = await api.builderExportCsv(projectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bot-${projectId.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToast("មិនអាចទាញយកទិន្នន័យបានទេ សូមព្យាយាមម្តងទៀត។");
    } finally {
      setExporting(false);
    }
  }

  const handle = project?.bot?.username ? `@${project.bot.username}` : "Bot";
  const owned = [
    { icon: "bot" as const, title: "Bot & ឈ្មោះ Telegram", text: `${handle} ត្រូវបានបង្កើតក្នុងគណនី Telegram របស់អ្នកផ្ទាល់ (Telegram Managed Bots)។ អ្នកអាចគ្រប់គ្រង ឬផ្ទេរវាក្នុង Telegram បានគ្រប់ពេល។` },
    { icon: "users" as const, title: "ទំនាក់ទំនង & ទិន្នន័យអតិថិជន", text: "បញ្ជីអតិថិជន និងការកុម្ម៉ង់ទាំងអស់ ជារបស់អ្នក ហើយអាចនាំចេញជា CSV បានគ្រប់ពេល។" },
    { icon: "file" as const, title: "កូដ & Server", text: "TeleScripts រក្សាទុក និងដំណើរការកូដលើ Cloud ជំនួសអ្នក — គ្មាន Token ឬ Server ដែលអ្នកត្រូវប៉ះ។" },
    { icon: "wrench" as const, title: "ការថែទាំដោយ AI", text: "AI ថែទាំ ធ្វើបច្ចុប្បន្នភាព និងជួសជុលដោយស្វ័យប្រវត្តិ។ រាល់សកម្មភាពត្រូវបានកត់ត្រាទុក។" },
  ];

  return (
    <AppShell header={<TopBar back={botHref(projectId)} title="កម្មសិទ្ធិ & ការធានា" subtitle={project?.name} />}>
      {state === "loading" && <ListSkeleton rows={3} />}
      {state === "error" && <StateView kind="error" onRetry={load} />}
      {state === "ready" && project && (
        <>
          <section className="ts-connect-hero">
            <span className="ts-connect-shield"><Icon name="shield" size={36} /></span>
            <span className="ts-pill ts-pill-success"><span className="ui-status-dot ui-dot-green" />កម្មសិទ្ធិផ្តាច់មុខ</span>
            <h2>Bot នេះជាកម្មសិទ្ធិរបស់អ្នក 100%</h2>
            <p>អ្នកជាម្ចាស់ស្របច្បាប់លើ Bot និងទិន្នន័យអតិថិជនទាំងអស់។ TeleScripts គ្រាន់តែជួយដំណើរការ និងថែទាំប៉ុណ្ណោះ។</p>
          </section>

          <section className="ts-stack">
            {owned.map((o) => (
              <div key={o.title} className="ts-connect-step">
                <span className="ts-tile ts-tile-sm ts-tile-success"><Icon name={o.icon} size={18} /></span>
                <div style={{ flex: 1 }}>
                  <h3 className="ts-row" style={{ justifyContent: "space-between" }}>{o.title}<Icon name="checkCircle" size={18} className="ts-success-text" /></h3>
                  <p className="ts-small">{o.text}</p>
                </div>
              </div>
            ))}
          </section>

          <Card className="ts-stack">
            <strong className="ts-row"><Icon name="download" size={20} className="ui-accent" />នាំចេញទិន្នន័យ</strong>
            <p className="ts-small ts-variant">ទាញយកបញ្ជីអតិថិជន និងការកុម្ម៉ង់ ជាឯកសារ CSV។</p>
            <Button variant="secondary" block icon="download" loading={exporting} disabled={!project.bot} onClick={exportCsv}>ទាញយកទិន្នន័យ (CSV)</Button>
          </Card>

          <Card className="ts-stack">
            <strong className="ts-row"><Icon name="users" size={20} className="ui-accent" />ផ្ទេរកម្មសិទ្ធិ</strong>
            <p className="ts-small ts-variant">ផ្ទេរ Bot ទៅម្ចាស់ថ្មីដោយផ្ទាល់ក្នុង Telegram។ នៅពេលកម្មសិទ្ធិប្តូរ TeleScripts ទទួលដំណឹងពី Telegram ហើយធ្វើបច្ចុប្បន្នភាពអ្នកទទួលការកុម្ម៉ង់ដោយស្វ័យប្រវត្តិ។</p>
            {project.bot?.username && <ButtonLink href={`https://t.me/${encodeURIComponent(project.bot.username)}`} external variant="secondary" block icon="send">បើក {handle} ក្នុង Telegram</ButtonLink>}
          </Card>

          <div className="ts-hint"><Icon name="lock" size={22} /><p>យើងមិនដែលស្នើសុំ Token ពាក្យសម្ងាត់ ឬកូនសោសម្ងាត់ពីអ្នកក្នុងផ្ទាំងជជែកឡើយ។</p></div>
        </>
      )}
      <Toast open={!!toast} message={toast} onClose={() => setToast(null)} />
    </AppShell>
  );
}
