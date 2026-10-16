"use client";

import { useEffect, useState } from "react";
import { api, type PaymentsConfig, type PlanSummary } from "@/lib/api";
import { ModelIcon } from "@/components/ModelIcon";
import { Badge, Button, Field, Icon, Input, ListSkeleton, StateView } from "@/components/ui/primitives";

type Step = 1 | 2 | 3;
type Method = "aba" | "other-bank";

const STEP_LABELS = ["ជ្រើសគម្រោង", "វិធីទូទាត់", "ទូទាត់"];
const PLAN_ICONS: Record<string, string> = { free: "✦", pro: "◆", premium: "✧" };
const PLAN_PITCH: Record<string, string> = {
  free: "ចាប់ផ្តើមសាកល្បង ៥ សំណើ/ថ្ងៃ",
  pro: "សម្រាប់ការងារប្រចាំថ្ងៃ ១០០ សំណើ/ថ្ងៃ",
  premium: "អ្វីៗទាំងអស់ ៥០០ សំណើ/ថ្ងៃ",
};

function modelsForTier(models: PaymentsConfig["models"], plan: PlanSummary) {
  return models.filter((m) => plan.tiers.includes(m.tier));
}

/**
 * Three-step subscription flow: plans -> payment method -> pay.
 * Plan price and allowed tiers always come from the server; the client only
 * picks ids. Premium shows "Coming soon" + waitlist when payments are off.
 */
export function Subscription({ currentPlan }: { currentPlan?: string | null }) {
  const [cfg, setCfg] = useState<PaymentsConfig | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [planId, setPlanId] = useState<string | null>(null);
  const [method, setMethod] = useState<Method>("aba");
  const [trxId, setTrxId] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [waitEmail, setWaitEmail] = useState("");
  const [waitDone, setWaitDone] = useState(false);
  const [waitBusy, setWaitBusy] = useState(false);

  function load() {
    setLoadError(false);
    api
      .paymentsConfig()
      .then((c) => {
        setCfg(c);
        const firstPaid = c.plans.find((p) => p.priceUsd > 0)?.id || c.plans[0]?.id;
        if (firstPaid) setPlanId(firstPaid);
      })
      .catch(() => setLoadError(true));
  }
  useEffect(load, []);

  if (loadError) return <StateView kind="error" onRetry={load} />;
  if (!cfg) return <ListSkeleton rows={3} />;

  const plan = cfg.plans.find((p) => p.id === planId) || null;
  const needsWaitlist = !cfg.enabled && plan?.id !== "free";

  async function submit() {
    if (!plan || !receipt || !trxId.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("planId", plan.id);
      form.set("method", method === "aba" ? "aba" : "khqr");
      form.set("trxId", trxId.trim());
      form.set("receipt", receipt);
      await api.submitPayment(form);
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function joinWaitlist() {
    if (!waitEmail.trim() || waitBusy) return;
    setWaitBusy(true);
    try {
      await api.joinWaitlist(waitEmail.trim());
      setWaitDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setWaitBusy(false);
    }
  }

  return (
    <div className="ts-stack" aria-label="គម្រោង">
      <ol className="ts-steps" aria-label={STEP_LABELS[step - 1]}>
        {STEP_LABELS.map((label, i) => (
          <li key={label} className={`${step === i + 1 ? "active" : ""} ${step > i + 1 ? "done" : ""}`}>{label}</li>
        ))}
      </ol>

      {step === 1 && (
        <>
          {cfg.plans.map((p) => {
            const unlocked = modelsForTier(cfg.models, p);
            return (
              <button key={p.id} type="button" className={`ts-select-row${planId === p.id ? " selected" : ""}`} aria-pressed={planId === p.id} onClick={() => setPlanId(p.id)}>
                <span className="ts-tile ts-tile-sm ts-tile-accent" aria-hidden="true">{PLAN_ICONS[p.id] || "✦"}</span>
                <span className="ts-select-main">
                  <strong className="ts-row">{p.label} · {p.dailyLimit} សំណើ/ថ្ងៃ{currentPlan === p.id && <Badge tone="green">គម្រោងបច្ចុប្បន្ន</Badge>}</strong>
                  <small>{PLAN_PITCH[p.id] || p.label}</small>
                  {unlocked.length > 0 && (
                    <span className="ts-model-chips">
                      {unlocked.map((m) => <span key={m.id} className="ts-model-chip"><ModelIcon icon={m.icon} label={m.label} size={14} />{m.label}</span>)}
                    </span>
                  )}
                </span>
                <span className="ts-select-price">
                  <b>${p.priceUsd}/ខែ</b>
                  {p.savePct > 0 && <Badge tone="green">-{p.savePct}%</Badge>}
                </span>
              </button>
            );
          })}
          <Button block disabled={!plan || plan.priceUsd === 0} trailingIcon={plan?.priceUsd === 0 ? undefined : "arrowRight"} onClick={() => (needsWaitlist ? setStep(3) : setStep(2))}>
            {plan?.priceUsd === 0 ? "ឆាប់ៗនេះ" : "បន្ត"}
          </Button>
        </>
      )}

      {step === 2 && plan && !needsWaitlist && (
        <>
          <button type="button" className={`ts-select-row${method === "aba" ? " selected" : ""}`} onClick={() => setMethod("aba")} aria-pressed={method === "aba"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/pay/aba.svg" alt="" aria-hidden="true" className="ts-pay-logo" />
            <span className="ts-select-main"><strong>ABA Mobile</strong><small>ABA Mobile · KHQR</small></span>
          </button>
          <button type="button" className={`ts-select-row${method === "other-bank" ? " selected" : ""}`} onClick={() => setMethod("other-bank")} aria-pressed={method === "other-bank"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/pay/khqr.svg" alt="" aria-hidden="true" className="ts-pay-logo" />
            <span className="ts-select-main"><strong>ធនាគារផ្សេងទៀត</strong><small>KHQR · Bakong</small></span>
          </button>
          <div className="ts-row">
            <Button variant="secondary" icon="arrowLeft" onClick={() => setStep(1)}>ថយក្រោយ</Button>
            <Button block trailingIcon="arrowRight" onClick={() => setStep(3)}>បន្ត</Button>
          </div>
        </>
      )}

      {step === 3 && plan && !done && !needsWaitlist && (
        <>
          <div className="ts-pay-hero">
            <small>{plan.label} · ស្កេនដើម្បីទូទាត់</small>
            <div className="ts-pay-price">${plan.priceUsd}</div>
            {cfg.khqrImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="ts-khqr" src={cfg.khqrImageUrl} alt="KHQR" />
            ) : (
              <div className="ts-khqr ts-khqr-empty">KHQR</div>
            )}
          </div>
          <div className="ts-between ts-small">
            <span>ចំនួនទឹកប្រាក់: <b>${plan.priceUsd}</b></span>
            <Button size="sm" variant="ghost" icon={copied ? "check" : "copy"} onClick={() => { navigator.clipboard?.writeText(String(plan.priceUsd)).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              {copied ? "បានចម្លង" : "ចម្លង"}
            </Button>
          </div>
          <Field label="លេខប្រតិបត្តិការ (Transaction ID)"><Input value={trxId} onChange={(e) => setTrxId(e.target.value)} placeholder="TRX-…" autoComplete="off" /></Field>
          <Field label="រូបភាពបង្កាន់ដៃ" hint="PNG/JPG/WebP/PDF, អតិបរមា 5 MB">
            <Input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] || null)} />
          </Field>
          {error && <div className="ts-error" role="alert">{error}</div>}
          <div className="ts-row">
            <Button variant="secondary" icon="arrowLeft" onClick={() => setStep(2)}>ថយក្រោយ</Button>
            <Button block loading={busy} disabled={!receipt || !trxId.trim()} onClick={submit}>ផ្ញើការទូទាត់</Button>
          </div>
        </>
      )}

      {step === 3 && done && (
        <div className="ts-notice ts-row" role="status"><Icon name="clock" size={18} />បានទទួលការទូទាត់ — កំពុងរង់ចាំការផ្ទៀងផ្ទាត់ពីក្រុមការងារ។</div>
      )}

      {needsWaitlist && plan && (
        <div className="ts-warn ts-stack">
          <strong>🚧 {plan.label} — ឆាប់ៗនេះ</strong>
          {waitDone ? (
            <p className="ts-row"><Icon name="checkCircle" size={18} />បានចុះឈ្មោះក្នុងបញ្ជីរង់ចាំ</p>
          ) : (
            <div className="ts-row">
              <Input type="email" value={waitEmail} onChange={(e) => setWaitEmail(e.target.value)} placeholder="អ៊ីមែលរបស់អ្នក" aria-label="អ៊ីមែលរបស់អ្នក" />
              <Button size="sm" loading={waitBusy} disabled={!waitEmail.trim()} onClick={joinWaitlist}>ចុះឈ្មោះ</Button>
            </div>
          )}
          {error && <div className="ts-error" role="alert">{error}</div>}
          {step === 3 && <Button size="sm" variant="secondary" icon="arrowLeft" onClick={() => setStep(1)}>ថយក្រោយ</Button>}
        </div>
      )}
    </div>
  );
}
