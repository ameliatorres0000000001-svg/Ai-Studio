"use client";

import Link from "next/link";
import { useState } from "react";
import type { AgentEvent } from "@/lib/agent/run";
import type { PublicEvent, PublicProject, StepName } from "@/lib/builder/types";
import { Accordion, Badge, Button, ButtonLink, Icon, ProgressBar, Toast, type IconName } from "@/components/ui/primitives";

export type StepStatus = "done" | "running" | "waiting" | "error";

export interface BuildLog {
  tone: "ok" | "run" | "wait" | "err";
  text: string;
}

export interface BuildState {
  steps: StepStatus[];
  /** Short live line under the running step. */
  activity?: string;
  logs: BuildLog[];
  error?: string | null;
}

export const BUILD_STEPS: { title: string; sub: string; icon: IconName; activity: string }[] = [
  { title: "ជំហានទី ១: រៀបចំរចនាសម្ព័ន្ធគម្រោង", sub: "Project Architecture & Secure Environment Setup", icon: "folder", activity: "កំពុងរៀបចំគម្រោង និងបរិស្ថានសុវត្ថិភាព..." },
  { title: "ជំហានទី ២: បង្កើតមូលដ្ឋានទិន្នន័យផលិតផល", sub: "Database Schema & Cloud Storage Provisioning", icon: "database", activity: "កំពុងរៀបចំកាតាឡុកទំនិញ និងទិន្នន័យ..." },
  { title: "ជំហានទី ៣: សរសេរតក្កវិជ្ជា និងប្រព័ន្ធ Bot", sub: "Bot Engine Logic & NLP Processing", icon: "bot", activity: "កំពុងតភ្ជាប់ KHQR និងប្រព័ន្ធបញ្ជាទិញ..." },
  { title: "ជំហានទី ៤: ដាក់ឲ្យដំណើរការលើ Cloud", sub: "Cloud Edge Deployment & Webhook Link", icon: "cloud", activity: "កំពុងដាក់ឲ្យដំណើរការលើ Cloud..." },
  { title: "ជំហានទី ៥: ធ្វើតេស្តសាកល្បងស្វ័យប្រវត្តិ", sub: "Automated Smoke Testing & Safety Checks", icon: "verified", activity: "កំពុងធ្វើតេស្តសាកល្បង..." },
];

const KHMER_DIGITS = "០១២៣៤៥៦៧៨៩";
export const toKhmerDigits = (n: number | string) => String(n).replace(/\d/g, (d) => KHMER_DIGITS[Number(d)]);

/**
 * Maps the agent SSE stream (lib/agent/run.ts AgentEvent, /api/agent/stream)
 * onto the five build stages: TodoWrite items drive the stages when present,
 * otherwise tool activity advances them; `done`/`error` settle the run.
 */
export function agentEventsToBuild(events: AgentEvent[]): BuildState {
  const steps: StepStatus[] = BUILD_STEPS.map(() => "waiting");
  const logs: BuildLog[] = [];
  let progress = 0;
  let error: string | null = null;
  let finished = false;
  for (const ev of events) {
    if (ev.type === "todo" && ev.items.length) {
      const done = ev.items.filter((i) => i.status === "completed").length;
      progress = Math.max(progress, Math.floor((done / ev.items.length) * BUILD_STEPS.length));
    } else if (ev.type === "tool_use") {
      progress = Math.max(progress, Math.min(BUILD_STEPS.length - 2, Math.floor(logs.length / 3)));
      logs.push({ tone: "run", text: `→ ${ev.name}` });
    } else if (ev.type === "tool_result") {
      logs.push({ tone: ev.ok ? "ok" : "err", text: `${ev.ok ? "✓" : "✕"} ${ev.summary}` });
    } else if (ev.type === "done") {
      finished = !ev.isError;
      if (ev.isError) error = ev.errors.join(" · ") || "Build failed";
    } else if (ev.type === "error") {
      error = ev.message;
    }
  }
  for (let i = 0; i < steps.length; i++) {
    if (finished || i < progress) steps[i] = "done";
    else if (i === progress) steps[i] = error ? "error" : "running";
  }
  const running = steps.indexOf("running");
  return { steps, logs, error, activity: running >= 0 ? BUILD_STEPS[running].activity : undefined };
}

/** Which pipeline steps (lib/builder/types.ts STEPS) feed each of the five timeline rows. */
const UI_ROWS: StepName[][] = [["provision_repo"], ["provision_data"], ["deploy"], ["set_webhook"], ["smoke_test", "handoff"]];

/**
 * Maps the real pipeline's builder_events (SSE from /api/builder/projects/:id/events)
 * onto the five-row timeline. A row is done when all its steps are done, failed
 * when one failed, running when one started/retried.
 */
export function pipelineToBuild(events: PublicEvent[], run: PublicProject["run"]): BuildState {
  const latest = new Map<StepName, PublicEvent>();
  const done = new Set<StepName>();
  for (const e of events) {
    if (e.status === "done") done.add(e.step);
    if (e.status === "started" && done.has(e.step)) done.delete(e.step); // a rerun of the step
    latest.set(e.step, e);
  }
  const steps: StepStatus[] = UI_ROWS.map((group) => {
    if (group.every((s) => done.has(s))) return "done";
    if (group.some((s) => latest.get(s)?.status === "failed")) return "error";
    if (group.some((s) => latest.has(s))) return "running";
    return "waiting";
  });
  const running = steps.findIndex((s) => s === "running");
  const activityEvent = running >= 0 ? UI_ROWS[running].map((s) => latest.get(s)).filter(Boolean).pop() : undefined;
  const logs: BuildLog[] = events.slice(-60).map((e) => ({
    tone: e.status === "done" ? "ok" : e.status === "failed" ? "err" : e.status === "waiting" ? "wait" : "run",
    text: `${e.status === "done" ? "✓" : e.status === "failed" ? "✕" : e.status === "retry" ? "↻" : "→"} ${e.message}`,
  }));
  return {
    steps,
    logs,
    error: run?.status === "failed" ? run.error || "មានបញ្ហា" : null,
    activity: activityEvent && activityEvent.status !== "started" ? activityEvent.message : running >= 0 ? BUILD_STEPS[running].activity : undefined,
  };
}

/** Rough "about N seconds left" from the rows still to go (deploys take the longest). */
export function estimateEta(state: BuildState): number {
  const weights = [10, 5, 60, 5, 10];
  return state.steps.reduce((sum, s, i) => sum + (s === "done" ? 0 : s === "running" ? Math.ceil(weights[i] / 2) : weights[i]), 0);
}

const STATUS_BADGE: Record<StepStatus, { label: string; cls: string }> = {
  done: { label: "រួចរាល់", cls: "done" },
  running: { label: "កំពុងដំណើរការ", cls: "running" },
  waiting: { label: "រង់ចាំ", cls: "waiting" },
  error: { label: "មានបញ្ហា", cls: "error" },
};

/** 05 Build progress — live stage timeline, AI self-repair, collapsible technical logs. */
export function BuildProgress({ state, etaSec, onRepair }: { state: BuildState; etaSec?: number; onRepair?: () => void }) {
  const [toast, setToast] = useState(false);
  const total = state.steps.length;
  const done = state.steps.filter((s) => s === "done").length;
  const runningIdx = state.steps.findIndex((s) => s === "running" || s === "error");
  const pct = Math.round(((done + (state.steps.includes("running") ? 0.5 : 0)) / total) * 100);
  const failed = !!state.error;

  return (
    <>
      <section className={`ts-build-hero${failed ? " failed" : ""}`}>
        <div className="ts-between" style={{ alignItems: "flex-start" }}>
          <div className="ts-row" style={{ gap: 8, alignItems: "flex-start" }}>
            <span className="ts-build-orb">
              <Icon name={failed ? "alert" : "bot"} size={26} className={failed ? "" : "ts-slow-spin"} />
              {!failed && <i aria-hidden="true" />}
            </span>
            <div>
              <h2>{failed ? "ការបង្កើតបានជួបបញ្ហា" : "AI កំពុងបង្កើត និងដំឡើង Bot..."}</h2>
              <p className="ts-row ts-small ts-variant" style={{ gap: 4 }}>
                {failed ? <span>{state.error}</span> : <><Icon name="clock" size={16} className="ts-success-text" />នៅសល់ប្រហែល <b className="ts-eta">{etaSec ?? "—"}</b> វិនាទី</>}
              </p>
            </div>
          </div>
          <Badge tone={failed ? "red" : "green"}>{pct}% រួចរាល់</Badge>
        </div>
        <div className="ts-stack" style={{ gap: 6, marginTop: 16 }}>
          <ProgressBar value={pct} label="ការរីកចម្រើន" />
          <div className="ts-between ts-micro">
            <span className="ts-variant" style={{ fontWeight: 500 }}>កំពុងដំណើរការជំហានទី {toKhmerDigits(Math.max(1, runningIdx + 1 || done))} ក្នុងចំណោម {toKhmerDigits(total)}</span>
            <span className="ts-accent-text" style={{ fontWeight: 500 }}>ស្ថិរភាពប្រព័ន្ធខ្ពស់</span>
          </div>
        </div>
      </section>

      <section className="ts-timeline-card">
        <div className="ts-between" style={{ marginBottom: 16 }}>
          <span className="ts-row ts-timeline-title"><Icon name="hub" size={20} className="ui-accent" />ដំណើរការសាងសង់តាមដំណាក់កាល</span>
          <span className="ts-live"><span className="ui-status-dot ui-dot-green ui-pulse" />បច្ចុប្បន្នភាពផ្ទាល់</span>
        </div>
        <ol className="ts-timeline">
          {BUILD_STEPS.map((step, i) => {
            const status = state.steps[i];
            return (
              <li key={step.title} className={`ts-step ${status}`}>
                <span className="ts-step-dot" aria-hidden="true">
                  <Icon name={status === "done" ? "check" : status === "running" ? "refresh" : status === "error" ? "alert" : step.icon} size={18} className={status === "running" ? "ui-spin" : ""} />
                </span>
                <div className="ts-step-body">
                  <div className="ts-step-head">
                    <h3>{step.title}</h3>
                    <span className={`ts-step-badge ${STATUS_BADGE[status].cls}`}>{STATUS_BADGE[status].label}</span>
                  </div>
                  <p>{step.sub}</p>
                  {status === "running" && state.activity && (
                    <div className="ts-step-activity"><span className="ts-ping-dot" aria-hidden="true" />{state.activity}</div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="ts-repair">
        <div className="ts-row" style={{ alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
          <span className="ts-tile ts-tile-success ts-tile-round" style={{ width: 36, height: 36, flexBasis: 36 }}><Icon name="shield" size={20} /></span>
          <div>
            <h4>ប្រព័ន្ធជួសជុលបញ្ហាដោយស្វ័យប្រវត្តិ</h4>
            <p className="ts-small ts-variant">ប្រសិនបើមានបញ្ហារអាក់រអួល ប្រព័ន្ធ AI នឹងជួសជុល និងដោះស្រាយកំហុសស្វ័យប្រវត្តិភ្លាមៗ ដោយមិនបាច់រង់ចាំអ្នកបច្ចេកទេសឡើយ។</p>
          </div>
        </div>
        <button type="button" className="ts-repair-btn" onClick={() => (failed && onRepair ? onRepair() : setToast(true))}>
          <Icon name="wrench" size={18} />
          <span>ឲ្យ AI ជួសជុលភ្លាមៗ 🛠️</span>
        </button>
      </section>

      <Accordion icon="terminal" title="មើលលម្អិតបច្ចេកទេស (Technical Details)">
        <div className="ts-code">
          {state.logs.map((l, i) => <div key={i} className={l.tone}>{l.text}</div>)}
        </div>
      </Accordion>

      <div className="ts-hint">
        <Icon name="bell" size={24} />
        <p>អ្នកអាចបិទអេក្រង់នេះបាន។ យើងខ្ញុំនឹងផ្ញើសារជូនដំណឹងទៅកាន់ Telegram របស់អ្នកភ្លាមៗនៅពេល Bot ដំណើរការរួចរាល់!</p>
      </div>

      <Toast open={toast} message="មិនទាន់មានកំហុសទេ — ប្រសិនបើមានបញ្ហា AI នឹងព្យាយាមជួសជុលដោយស្វ័យប្រវត្តិរហូតដល់ ២ ដង។" onClose={() => setToast(false)} />
    </>
  );
}

/** 06 Success — calm hand-over with one-tap launchers and the ownership guarantee. */
export function BuildSuccess({
  botName, botUsername, botUrl, miniAppUrl, logs, dashboardHref, ownershipHref, onAnother,
}: {
  botName: string; botUsername: string | null; botUrl: string | null; miniAppUrl: string | null; logs: BuildLog[];
  dashboardHref: string; ownershipHref: string; onAnother: () => void;
}) {
  const handle = botUsername ? `@${botUsername}` : botName;
  return (
    <>
      <section className="ts-success-hero">
        <span className="ts-success-mark"><Icon name="check" size={40} /></span>
        <span className="ts-pill ts-pill-success" style={{ alignSelf: "center" }}><Icon name="sparkles" size={14} />រួចរាល់ 100%</span>
        <h1>Bot របស់អ្នកដំណើរការហើយ!</h1>
        <p><b>{botName}</b> ត្រូវបានដាក់ឲ្យដំណើរការរួចរាល់ ហើយជាកម្មសិទ្ធិរបស់អ្នកទាំងស្រុង។</p>
      </section>

      <section className="ts-stack">
        <span className="ts-mini-title">ចាប់ផ្តើមប្រើប្រាស់</span>
        {botUsername && (
          <a className="ts-launch" href={`https://t.me/${encodeURIComponent(botUsername)}`} target="_blank" rel="noopener noreferrer">
            <span className="ts-tile ts-tile-solid"><Icon name="send" size={22} /></span>
            <span className="ts-launch-text"><b>បើក bot ក្នុង Telegram</b><small>{handle}</small></span>
            <Icon name="external" size={18} />
          </a>
        )}
        {miniAppUrl && botUsername && (
          <a className="ts-launch" href={`https://t.me/${encodeURIComponent(botUsername)}`} target="_blank" rel="noopener noreferrer">
            <span className="ts-tile ts-tile-accent"><Icon name="phone" size={22} /></span>
            <span className="ts-launch-text"><b>បើក Mini App</b><small>ចុចប៊ូតុង «ហាង» ក្នុង {handle}</small></span>
            <Icon name="external" size={18} />
          </a>
        )}
        <Link className="ts-launch" href={dashboardHref}>
          <span className="ts-tile ts-tile-warm"><Icon name="chart" size={22} /></span>
          <span className="ts-launch-text"><b>ផ្ទាំងគ្រប់គ្រង</b><small>ទិន្នន័យ ការកំណត់ និងកំណត់ត្រា</small></span>
          <Icon name="chevronRight" size={18} />
        </Link>
      </section>

      <Link href={ownershipHref} className="ts-own-card">
        <span className="ts-secure-icon"><Icon name="verified" size={20} /></span>
        <span>
          <strong>កម្មសិទ្ធិ 100% ជារបស់អ្នក</strong>
          <small>Bot ឈ្មោះ Bot និងទិន្នន័យអតិថិជនទាំងអស់ ជាកម្មសិទ្ធិស្របច្បាប់របស់អ្នក។ ចុចដើម្បីមើលលម្អិត។</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </Link>

      <Accordion icon="terminal" title="មើលលម្អិតបច្ចេកទេស (Technical Details)">
        <div className="ts-code">
          {botUrl && <div className="ok">✓ {botUrl.replace(/^https?:\/\//, "")}</div>}
          {logs.map((l, i) => <div key={i} className={l.tone}>{l.text}</div>)}
        </div>
      </Accordion>

      <div className="ts-stack">
        <ButtonLink href="/bot-builder/bots" block icon="bot">ទៅកាន់ Bot របស់ខ្ញុំ</ButtonLink>
        <Button variant="secondary" block icon="plus" onClick={onAnother}>បង្កើត Bot មួយទៀត</Button>
      </div>
    </>
  );
}
