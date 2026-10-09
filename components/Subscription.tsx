"use client";

import { useEffect, useState } from "react";
import { api, type PaymentsConfig, type PlanSummary } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { ModelIcon } from "@/components/ModelIcon";

type Step = 1 | 2 | 3;
type Method = "aba" | "other-bank";

const PLAN_ICONS: Record<string, string> = { free: "✦", pro: "◆", premium: "✧" };
const PLAN_PITCH: Record<string, { kh: string; en: string }> = {
  free: { kh: "ចាប់ផ្តើមសាកល្បង ៥ សំណើ/ថ្ងៃ", en: "Try it out — 5 requests/day" },
  pro: { kh: "សម្រាប់ការងារប្រចាំថ្ងៃ ១០០ សំណើ/ថ្ងៃ", en: "For daily work — 100 requests/day" },
  premium: { kh: "អ្វីៗទាំងអស់ ៥០០ សំណើ/ថ្ងៃ", en: "Everything unlocked — 500 requests/day" },
};

function modelsForTier(models: PaymentsConfig["models"], plan: PlanSummary) {
  return models.filter((m) => plan.tiers.includes(m.tier));
}

/**
 * Three-step subscription flow: plans -> payment method -> pay.
 * Plan price and allowed tiers always come from the server; the client only
 * picks ids. Premium shows "Coming soon" + waitlist when payments are off.
 */
export function Subscription() {
  const { t, lang } = useLang();
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

  useEffect(() => {
    api
      .paymentsConfig()
      .then((c) => {
        setCfg(c);
        const firstPaid = c.plans.find((p) => p.priceUsd > 0)?.id || c.plans[0]?.id;
        if (firstPaid) setPlanId(firstPaid);
      })
      .catch(() => setLoadError(true));
  }, []);

  if (loadError) return <div className="chat-error">{t("error")}</div>;
  if (!cfg) return <div className="chat-loading"><div className="spinner" />{t("loading")}</div>;

  const plan = cfg.plans.find((p) => p.id === planId) || null;
  const needsWaitlist = !cfg.enabled && plan?.id !== "free";
  const stepLabel = [t("stepPlan"), t("stepMethod"), t("stepPay")][step - 1];

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
    <div className="co-wrap" aria-label={t("subscription")}>
      <div className="co-steps" aria-label={stepLabel}>
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`co-step ${step === s ? "active" : ""} ${step > s ? "done" : ""}`}
          >
            {s === 1 ? t("stepPlan") : s === 2 ? t("stepMethod") : t("stepPay")}
          </div>
        ))}
      </div>

      {/* Step 1: plans */}
      {step === 1 && (
        <>
          {cfg.plans.map((p) => {
            const unlocked = modelsForTier(cfg.models, p);
            const pitch = PLAN_PITCH[p.id] || { kh: p.label, en: p.label };
            return (
              <button
                key={p.id}
                type="button"
                className={`co-plan-row ${planId === p.id ? "selected" : ""}`}
                aria-pressed={planId === p.id}
                onClick={() => setPlanId(p.id)}
              >
                <span className="co-plan-icon" aria-hidden="true">
                  {PLAN_ICONS[p.id] || "✦"}
                </span>
                <span className="co-plan-main">
                  <strong>
                    {p.label} · {p.dailyLimit} {t("perDay")}
                  </strong>
                  <small>{lang === "kh" ? pitch.kh : pitch.en}</small>
                  <span className="co-chips">
                    {unlocked.map((m) => (
                      <span key={m.id} className="co-chip">
                        <ModelIcon icon={m.icon} label={m.label} size={16} />
                        {m.label}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="co-plan-price">
                  <b>${p.priceUsd}/mo</b>
                  {p.savePct > 0 && <span className="co-save">-{p.savePct}%</span>}
                </span>
              </button>
            );
          })}
          <div className="co-sticky">
            <button
              type="button"
              className="co-btn"
              disabled={!plan || plan.priceUsd === 0}
              onClick={() => (needsWaitlist ? setStep(3) : setStep(2))}
            >
              {plan?.priceUsd === 0 ? t("comingSoon") : `${t("continueBtn")} →`}
            </button>
          </div>
        </>
      )}

      {/* Step 2: payment method (skipped when payments are off) */}
      {step === 2 && plan && !needsWaitlist && (
        <>
          <button
            type="button"
            className={`co-method-row ${method === "aba" ? "selected" : ""}`}
            onClick={() => setMethod("aba")}
            aria-pressed={method === "aba"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/pay/aba.svg" alt="" aria-hidden="true" />
            <span>
              <strong>{t("abaMobile")}</strong>
              <small>ABA Mobile · KHQR</small>
            </span>
          </button>
          <button
            type="button"
            className={`co-method-row ${method === "other-bank" ? "selected" : ""}`}
            onClick={() => setMethod("other-bank")}
            aria-pressed={method === "other-bank"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/pay/khqr.svg" alt="" aria-hidden="true" />
            <span>
              <strong>{t("otherBanks")}</strong>
              <small>KHQR · Bakong</small>
            </span>
          </button>
          <div className="co-sticky" style={{ display: "flex", gap: 8 }}>
            <button type="button" className="co-btn co-btn-ghost" onClick={() => setStep(1)}>
              {t("backBtn")}
            </button>
            <button type="button" className="co-btn" onClick={() => setStep(3)}>
              {t("continueBtn")} →
            </button>
          </div>
        </>
      )}

      {/* Step 3: pay */}
      {step === 3 && plan && !done && !needsWaitlist && (
        <>
          <div className="co-pay-hero">
            <small>{plan.label} · {t("scanPay")}</small>
            <div className="co-price-hero">${plan.priceUsd}</div>
            {cfg.khqrImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="co-khqr" src={cfg.khqrImageUrl} alt="KHQR" />
            ) : (
              <div className="co-khqr-empty">KHQR</div>
            )}
          </div>
          <div className="co-field">
            <span>
              {t("payAmount")}: <b>${plan.priceUsd}</b>
              <button
                type="button"
                className="integration-connect"
                style={{ marginLeft: 8 }}
                onClick={() => {
                  navigator.clipboard?.writeText(String(plan.priceUsd)).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? t("copied") : t("copyBtn")}
              </button>
            </span>
          </div>
          <label className="co-field">
            <span>{t("trxLabel")}</span>
            <input
              className="co-input"
              value={trxId}
              onChange={(e) => setTrxId(e.target.value)}
              placeholder="TRX-…"
              autoComplete="off"
            />
          </label>
          <label className="co-field">
            <span>{t("receiptLabel")} (PNG/JPG/WebP/PDF, max 5 MB)</span>
            <input
              className="co-input"
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(e) => setReceipt(e.target.files?.[0] || null)}
            />
          </label>
          {error && <div className="co-error">{error}</div>}
          <div className="co-sticky" style={{ display: "flex", gap: 8 }}>
            <button type="button" className="co-btn co-btn-ghost" onClick={() => setStep(2)}>
              {t("backBtn")}
            </button>
            <button
              type="button"
              className="co-btn"
              disabled={busy || !receipt || !trxId.trim()}
              onClick={submit}
            >
              {busy ? t("loading") : t("submitPayment")}
            </button>
          </div>
        </>
      )}

      {step === 3 && done && (
        <div className="co-pending" role="status">
          <span aria-hidden="true">⏳</span>
          <div>{t("paymentPending")}</div>
        </div>
      )}

      {/* Payments off: free tier or waitlist */}
      {needsWaitlist && plan && (
        <div className="co-coming">
          <div>🚧 {plan.label} — {t("comingSoon")}</div>
          {waitDone ? (
            <p className="co-note">✓</p>
          ) : (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                className="co-input"
                type="email"
                value={waitEmail}
                onChange={(e) => setWaitEmail(e.target.value)}
                placeholder={t("waitlistPlaceholder")}
              />
              <button
                type="button"
                className="co-btn"
                style={{ width: "auto" }}
                disabled={waitBusy || !waitEmail.trim()}
                onClick={joinWaitlist}
              >
                {t("waitlistJoin")}
              </button>
            </div>
          )}
          {step === 3 && (
            <button type="button" className="co-btn co-btn-ghost" style={{ marginTop: 10 }} onClick={() => setStep(1)}>
              {t("backBtn")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
