"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { BotConfig } from "@/lib/bot-builder/config";
import type { PublicProject } from "@/lib/builder/types";
import {
  Badge, Button, Card, Field, Icon, IconButton, Input, ListSkeleton, StateView, Toast, useOnline, type Tone,
} from "@/components/ui/primitives";

export type BotProject = PublicProject;

export type ProjectsState = "loading" | "ready" | "error" | "disabled";

/** Loads the user's bots (GET /api/builder/projects). 403 means Bot Builder is not enabled for the account. */
export function useBotProjects() {
  const [projects, setProjects] = useState<BotProject[]>([]);
  const [state, setState] = useState<ProjectsState>("loading");
  const load = useCallback(() => {
    setState("loading");
    api
      .builderList()
      .then(({ projects }) => { setProjects(projects); setState("ready"); })
      .catch((e: any) => { setProjects([]); setState(e?.status === 403 ? "disabled" : "error"); });
  }, []);
  useEffect(load, [load]);
  return { projects, state, reload: load };
}

export function botHref(projectId: string, sub = ""): string {
  return `/bot-builder/bot${sub}?id=${encodeURIComponent(projectId)}`;
}

/** Legacy bots (generated into the user's own GitHub before the platform pipeline). */
export function legacyBotHref(repo: string): string {
  return `/bot-builder/bot?repo=${encodeURIComponent(repo)}`;
}

export function statusBadge(status: PublicProject["status"]): { tone: Tone; label: string } {
  switch (status) {
    case "live": return { tone: "green", label: "ដំណើរការ" };
    case "building": return { tone: "blue", label: "កំពុងបង្កើត" };
    case "waiting_bot": return { tone: "blue", label: "រង់ចាំ Telegram" };
    case "failed": return { tone: "red", label: "មានបញ្ហា" };
    default: return { tone: "yellow", label: "ព្រាង (Draft)" };
  }
}

/** Khmer relative time ("2 ម៉ោងមុន"). */
export function timeAgoKh(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ទើបតែឥឡូវ";
  if (min < 60) return `${min} នាទីមុន`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ម៉ោងមុន`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} ថ្ងៃមុន`;
  return new Date(iso).toLocaleDateString("km-KH");
}

/**
 * Bot cards (02 Home "គម្រោងថ្មីៗរបស់អ្នក", 07 My bots). Every list state is
 * covered: skeleton while loading, offline, error with retry, empty and
 * "not enabled for this account".
 */
export function BotProjects({ projects, state, reload, limit, emptyTitle }: { projects: BotProject[]; state: ProjectsState; reload: () => void; limit?: number; emptyTitle?: string }) {
  const online = useOnline();
  if (!online && state !== "ready") return <StateView kind="offline" onRetry={reload} />;
  if (state === "loading") return <ListSkeleton rows={limit ? Math.min(limit, 2) : 3} />;
  if (state === "error") return <StateView kind="error" onRetry={reload} />;
  if (state === "disabled") {
    return <StateView kind="empty" icon="lock" title="Bot Builder មិនទាន់បើកសម្រាប់គណនីនេះទេ" description="មុខងារនេះកំពុងបើកជាដំណាក់កាល។ សូមទាក់ទងក្រុមការងារ ដើម្បីចូលរួមមុនគេ។" />;
  }
  if (projects.length === 0) {
    return <StateView kind="empty" title={emptyTitle || "មិនទាន់មាន Bot នៅឡើយទេ"} action={<Link href="/bot-builder" className="ui-btn ui-primary ui-sm"><Icon name="plus" size={18} />បង្កើត Bot ថ្មី</Link>} />;
  }
  const shown = limit ? projects.slice(0, limit) : projects;
  return (
    <div className="ts-bot-list">
      {shown.map((p, i) => {
        const badge = statusBadge(p.status);
        const live = p.status === "live";
        return (
          <article key={p.id} className="ts-bot-card">
            <div className="ts-between" style={{ alignItems: "flex-start" }}>
              <div className="ts-row" style={{ gap: 8 }}>
                <span className={`ts-tile ${i % 2 ? "ts-tile-warm" : "ts-tile-accent"}`}><Icon name={p.template === "faq-bot" ? "message" : "bot"} size={26} /></span>
                <div style={{ minWidth: 0 }}>
                  <h3>{p.name}</h3>
                  <p className="ts-handle">{p.bot?.username ? `@${p.bot.username}` : p.template === "faq-bot" ? "ឆ្លើយសំណួរ 24/7" : "ហាងលក់ទំនិញ"}</p>
                </div>
              </div>
              <Badge tone={badge.tone} dot pulse={live}>{badge.label}</Badge>
            </div>
            <div className="ts-between" style={{ paddingTop: 8 }}>
              {live ? (
                <span className="ts-bot-meta"><Icon name="bag" size={18} /><span><strong>{(p.ordersToday ?? 0).toLocaleString("km-KH")}</strong> កុម្ម៉ង់ថ្ងៃនេះ</span></span>
              ) : (
                <span className="ts-bot-meta"><Icon name="history" size={18} /><span className="ts-truncate">បានបង្កើត {timeAgoKh(p.createdAt)}</span></span>
              )}
              {live || p.status === "failed" ? (
                <Link href={botHref(p.id)} className="ts-soft-btn"><Icon name="bot" size={16} />កែសម្រួលជាមួយ AI</Link>
              ) : (
                <Link href={`/bot-builder?project=${encodeURIComponent(p.id)}`} className="ts-soft-btn neutral">បន្តបង្កើត<Icon name="arrowRight" size={16} /></Link>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ── Config editor (08 Bot detail → ការកំណត់) ─────────────────────────────── */

/** price is held as text so a half-typed number never gets rounded under the user. */
interface EditableProduct {
  name: string;
  price: string;
  currency: "USD" | "KHR";
  description: string;
}

interface EditableConfig {
  botName: string;
  language: "km" | "en" | "both";
  description: string;
  payment: { method: "manual" | "telegram_invoice" | "external_link"; details: string };
  adminTelegramUsername: string;
  products: EditableProduct[];
}

function toEditable(c: BotConfig): EditableConfig {
  return {
    botName: c.botName || "",
    language: c.language === "en" || c.language === "both" ? c.language : "km",
    description: c.description || "",
    payment: {
      method: c.payment?.method || "manual",
      details: c.payment?.details || "",
    },
    adminTelegramUsername: c.adminTelegramUsername || "",
    products: (c.products || []).map((p) => ({
      name: p.name || "",
      price: String(p.price ?? ""),
      currency: p.currency === "KHR" ? "KHR" : "USD",
      description: p.description || "",
    })),
  };
}

function toPayload(e: EditableConfig): BotConfig {
  return {
    botName: e.botName.trim(),
    language: e.language,
    description: e.description.trim(),
    payment: { method: e.payment.method, details: e.payment.details.trim() },
    adminTelegramUsername: e.adminTelegramUsername.trim(),
    products: e.products.map((p) => {
      const item: { name: string; price: number; currency: "USD" | "KHR"; description?: string } = {
        name: p.name.trim(),
        price: Number(p.price),
        currency: p.currency,
      };
      const d = p.description.trim();
      if (d) item.description = d;
      return item;
    }),
  };
}

function validationError(e: EditableConfig): string | null {
  if (!e.botName.trim()) return "ត្រូវការឈ្មោះហាង។";
  for (let i = 0; i < e.products.length; i++) {
    const p = e.products[i];
    if (!p.name.trim()) return `ទំនិញទី ${i + 1} ត្រូវការឈ្មោះ។`;
    const price = Number(p.price);
    if (!p.price.trim() || !Number.isFinite(price) || price < 0) return `ទំនិញទី ${i + 1} ត្រូវការតម្លៃត្រឹមត្រូវ។`;
  }
  return null;
}

/**
 * Edits a generated bot's config/bot.json through the GitHub API. Saving
 * pushes a commit, which is what makes Vercel rebuild the bot — no git or
 * redeploy by hand.
 */
export function BotConfigEditor({ projectId, repo, onLoaded }: { projectId?: string; repo?: string; onLoaded?: (config: BotConfig) => void }) {
  const [config, setConfig] = useState<EditableConfig | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const load = useCallback(() => {
    setLoadState("loading");
    setLoadError(null);
    const loader: Promise<BotConfig> = projectId
      ? api.builderGet(projectId).then(({ project }) => (project.config || {}) as unknown as BotConfig)
      : api.botBuilderProject(repo || "").then(({ config }) => config);
    loader
      .then((config) => { setConfig(toEditable(config)); setLoadState("ready"); onLoadedRef.current?.(config); })
      .catch((e: any) => { setLoadError(e?.message || null); setLoadState("error"); });
  }, [projectId, repo]);
  useEffect(load, [load]);

  async function save() {
    if (!config) return;
    const invalid = validationError(config);
    if (invalid) { setError(invalid); return; }
    setSaving(true);
    setError(null);
    try {
      if (projectId) await api.builderSaveConfig(projectId, toPayload(config));
      else await api.botBuilderSaveProject(repo || "", toPayload(config));
      setSaved(true);
    } catch (e: any) {
      setError(e.message || "មិនអាចរក្សាទុកបានទេ។");
    } finally {
      setSaving(false);
    }
  }

  function patchProduct(i: number, patch: Partial<EditableProduct>) {
    if (!config) return;
    setConfig({ ...config, products: config.products.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
  }

  if (loadState === "loading") return <ListSkeleton rows={2} />;
  if (loadState === "error" || !config) return <StateView kind="error" description={loadError || undefined} onRetry={load} />;

  return (
    <div className="ts-stack-lg">
      <Card className="ts-stack">
        <Field label="ឈ្មោះហាង"><Input value={config.botName} onChange={(e) => setConfig({ ...config, botName: e.target.value })} /></Field>
        <Field label="ការពិពណ៌នា"><Input value={config.description} onChange={(e) => setConfig({ ...config, description: e.target.value })} /></Field>
        <Field label="ភាសារបស់ Bot">
          <select className="ui-input" value={config.language} onChange={(e) => setConfig({ ...config, language: e.target.value as EditableConfig["language"] })}>
            <option value="km">ភាសាខ្មែរ 🇰🇭</option>
            <option value="en">English</option>
            <option value="both">ខ្មែរ + English</option>
          </select>
        </Field>
      </Card>

      <div className="ts-mini-form">
        <div className="ts-between">
          <span className="ts-row ts-mini-title"><Icon name="package" size={18} className="ui-accent" />ឈ្មោះមុខទំនិញ &amp; តម្លៃគំរូ</span>
          <span className="ts-micro ts-variant">{config.products.length} មុខបានបញ្ចូល</span>
        </div>
        {config.products.map((p, i) => (
          <div key={i} className="ts-product-edit">
            <div className="ts-product-edit-row">
              <Input aria-label="ឈ្មោះ" placeholder="ឈ្មោះ" value={p.name} onChange={(e) => patchProduct(i, { name: e.target.value })} />
              <IconButton label="លុបមុខទំនិញ" onClick={() => setConfig({ ...config, products: config.products.filter((_, idx) => idx !== i) })}><Icon name="trash" size={18} /></IconButton>
            </div>
            <div className="ts-product-edit-row">
              <Input aria-label="តម្លៃ" type="number" min="0" step="any" inputMode="decimal" placeholder="តម្លៃ" value={p.price} onChange={(e) => patchProduct(i, { price: e.target.value })} />
              <select className="ui-input ts-currency" aria-label="រូបិយប័ណ្ណ" value={p.currency} onChange={(e) => patchProduct(i, { currency: e.target.value as "USD" | "KHR" })}>
                <option value="USD">USD</option>
                <option value="KHR">KHR</option>
              </select>
            </div>
            <Input aria-label="ការពិពណ៌នា" placeholder="ការពិពណ៌នា (ស្រេចចិត្ត)" value={p.description} onChange={(e) => patchProduct(i, { description: e.target.value })} />
          </div>
        ))}
        <button type="button" className="ts-add-item" onClick={() => setConfig({ ...config, products: [...config.products, { name: "", price: "", currency: "USD", description: "" }] })}>
          <Icon name="plusCircle" size={18} className="ui-accent" />+ បន្ថែមមុខទំនិញ
        </button>
      </div>

      <Card className="ts-stack">
        <Field label="វិធីទូទាត់">
          <select className="ui-input" value={config.payment.method} onChange={(e) => setConfig({ ...config, payment: { ...config.payment, method: e.target.value as EditableConfig["payment"]["method"] } })}>
            <option value="manual">ផ្ទេរប្រាក់ផ្ទាល់ (ផ្ញើវិក្កយបត្រ) 🧾</option>
            <option value="external_link">ABA KHQR / តំណទូទាត់ 💳</option>
            <option value="telegram_invoice">វិក្កយបត្រ Telegram</option>
          </select>
        </Field>
        {config.payment.method === "external_link" && (
          <Field label="តំណទូទាត់"><Input value={config.payment.details} onChange={(e) => setConfig({ ...config, payment: { ...config.payment, details: e.target.value } })} placeholder="https://…" inputMode="url" /></Field>
        )}
        <Field label="Telegram username របស់ម្ចាស់ហាង"><Input value={config.adminTelegramUsername} onChange={(e) => setConfig({ ...config, adminTelegramUsername: e.target.value })} placeholder="@username" autoComplete="off" /></Field>
      </Card>

      {error && <div role="alert" className="ts-error">{error}</div>}
      <Button block onClick={save} loading={saving} trailingIcon="arrowRight">រក្សាទុក &amp; ដាក់ឲ្យដំណើរការ</Button>
      <p className="ts-small ts-muted" style={{ textAlign: "center" }}>ការរក្សាទុកនឹង deploy Bot សារជាថ្មីដោយស្វ័យប្រវត្តិ (ប្រហែល ១ នាទី)។</p>
      <Toast open={saved} tone="success" message="បានរក្សាទុក! Bot នឹងដំណើរការជាមួយទិន្នន័យថ្មីក្នុងពេលប្រហែល ១ នាទី។" onClose={() => setSaved(false)} />
    </div>
  );
}

/* ── FAQ bot editor (08 Bot detail → ការកំណត់, faq-bot template) ──────────── */

interface FaqItem { question: string; answer: string; keywords: string }

/** Edits config/faq.json for a FAQ bot; saving rebuilds and redeploys it. */
export function FaqConfigEditor({ projectId }: { projectId: string }) {
  const [cfg, setCfg] = useState<Record<string, any> | null>(null);
  const [items, setItems] = useState<FaqItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    setState("loading");
    api
      .builderGet(projectId)
      .then(({ project }) => {
        const c = (project.config || {}) as Record<string, any>;
        setCfg(c);
        setItems((Array.isArray(c.questions) ? c.questions : []).map((q: any) => ({ question: q.question || "", answer: q.answer || "", keywords: (q.keywords || []).join(", ") })));
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [projectId]);
  useEffect(load, [load]);

  async function save() {
    if (!cfg) return;
    if (!String(cfg.botName || "").trim()) { setError("ត្រូវការឈ្មោះ Bot។"); return; }
    const questions = items.filter((q) => q.question.trim() && q.answer.trim()).map((q) => ({ question: q.question.trim(), answer: q.answer.trim(), keywords: q.keywords.split(",").map((k) => k.trim()).filter(Boolean) }));
    setSaving(true);
    setError(null);
    try {
      await api.builderSaveConfig(projectId, { ...cfg, questions });
      setSaved(true);
    } catch (e: any) {
      setError(e.message || "មិនអាចរក្សាទុកបានទេ។");
    } finally {
      setSaving(false);
    }
  }

  if (state === "loading") return <ListSkeleton rows={2} />;
  if (state === "error" || !cfg) return <StateView kind="error" onRetry={load} />;
  return (
    <div className="ts-stack-lg">
      <Card className="ts-stack">
        <Field label="ឈ្មោះ Bot"><Input value={cfg.botName || ""} onChange={(e) => setCfg({ ...cfg, botName: e.target.value })} /></Field>
        <Field label="សារស្វាគមន៍"><Input value={cfg.welcome || ""} onChange={(e) => setCfg({ ...cfg, welcome: e.target.value })} /></Field>
      </Card>
      <div className="ts-mini-form">
        <div className="ts-between"><span className="ts-row ts-mini-title"><Icon name="message" size={18} className="ui-accent" />សំណួរ &amp; ចម្លើយ</span><span className="ts-micro ts-variant">{items.length} សំណួរ</span></div>
        {items.map((q, i) => (
          <div key={i} className="ts-product-edit">
            <div className="ts-product-edit-row">
              <Input aria-label="សំណួរ" placeholder="សំណួរ" value={q.question} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} />
              <IconButton label="លុបសំណួរ" onClick={() => setItems(items.filter((_, j) => j !== i))}><Icon name="trash" size={18} /></IconButton>
            </div>
            <Input aria-label="ចម្លើយ" placeholder="ចម្លើយ" value={q.answer} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} />
            <Input aria-label="ពាក្យគន្លឹះ" placeholder="ពាក្យគន្លឹះ (បំបែកដោយ ,)" value={q.keywords} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, keywords: e.target.value } : x)))} />
          </div>
        ))}
        <button type="button" className="ts-add-item" onClick={() => setItems([...items, { question: "", answer: "", keywords: "" }])}><Icon name="plusCircle" size={18} className="ui-accent" />+ បន្ថែមសំណួរ</button>
      </div>
      {error && <div role="alert" className="ts-error">{error}</div>}
      <Button block onClick={save} loading={saving} trailingIcon="arrowRight">រក្សាទុក &amp; ដាក់ឲ្យដំណើរការ</Button>
      <Toast open={saved} tone="success" message="បានរក្សាទុក! Bot កំពុងដាក់ឲ្យដំណើរការឡើងវិញ។" onClose={() => setSaved(false)} />
    </div>
  );
}
