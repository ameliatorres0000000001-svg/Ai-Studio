"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase-client";
import { AppShell, Badge, Button, Card, Icon, ListSkeleton, ProgressBar, SectionHeader, StateView, type IconName } from "@/components/ui/primitives";
import { BrandHeader } from "@/components/Dashboard";
import { Subscription } from "@/components/Subscription";

type Usage = Awaited<ReturnType<typeof api.getUsage>>;
type Payments = Awaited<ReturnType<typeof api.paymentHistory>>["payments"];

const PAYMENT_STATUS: Record<string, { tone: "yellow" | "green" | "red"; label: string }> = {
  pending: { tone: "yellow", label: "កំពុងពិនិត្យ" },
  approved: { tone: "green", label: "បានអនុម័ត" },
  rejected: { tone: "red", label: "បានបដិសេធ" },
};

/** 10 Account & plan — usage meter, current plan, payment history, language/support settings. */
export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [usageError, setUsageError] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [bots, setBots] = useState<{ used: number; limit: number } | null>(null);
  const [payments, setPayments] = useState<Payments | null>(null);
  const [paymentsError, setPaymentsError] = useState(false);

  function loadPayments() {
    setPaymentsError(false);
    api.paymentHistory().then(({ payments }) => setPayments(payments)).catch(() => setPaymentsError(true));
  }

  function loadUsage() {
    setUsageError(false);
    api.getUsage().then(setUsage).catch(() => setUsageError(true));
  }
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    loadUsage();
    loadPayments();
    api.builderLimits().then(setBots).catch(() => setBots(null));
  }, []);

  const pct = usage && !usage.unlimited && usage.dailyLimit > 0 ? (usage.today.requests / usage.dailyLimit) * 100 : 0;
  const links: { href: string; icon: IconName; label: string; sub: string }[] = [
    { href: "/settings/connectors", icon: "hub", label: "ការតភ្ជាប់", sub: "Telegram, GitHub, Vercel" },
    { href: "/help", icon: "headset", label: "ជំនួយ & ទំនាក់ទំនង", sub: "ជជែកជាមួយក្រុមការងារ" },
  ];
  if (usage?.isAdmin) links.push({ href: "/workspace", icon: "terminal", label: "តំបន់ធ្វើការអ្នកអភិវឌ្ឍន៍", sub: "Coding Agent workspace" });

  return (
    <AppShell header={<BrandHeader />}>
      <section className="ts-profile">
        <span className="ui-avatar" style={{ width: 56, height: 56 }}><Icon name="person" size={30} /></span>
        <div style={{ minWidth: 0 }}>
          <h1 className="ts-truncate">{email || "គណនីរបស់អ្នក"}</h1>
          {usage && <Badge tone={usage.plan === "free" ? "neutral" : "green"} dot>គម្រោង {usage.plan.toUpperCase()}</Badge>}
        </div>
      </section>

      <section className="ts-stack">
        <SectionHeader icon="chart" title="ការប្រើប្រាស់" />
        {usageError ? <StateView kind="error" onRetry={loadUsage} /> : !usage ? <ListSkeleton rows={1} /> : (
          <Card className="ts-stack">
            <div className="ts-between"><span className="ts-mini-title">សំណើ AI ថ្ងៃនេះ</span><b className="ts-figure">{usage.unlimited ? "∞" : `${usage.today.requests} / ${usage.dailyLimit}`}</b></div>
            {!usage.unlimited && <ProgressBar value={pct} label="សំណើ AI ថ្ងៃនេះ" />}
            {pct >= 80 && <p className="ts-small" style={{ color: "#7A5A17" }}>ជិតដល់កម្រិតថ្ងៃនេះហើយ — ដំឡើងគម្រោងដើម្បីប្រើបន្ថែម។</p>}
            <p className="ts-small ts-muted">{usage.today.inputTokens.toLocaleString()} in · {usage.today.outputTokens.toLocaleString()} out tokens</p>
            {bots && (
              <>
                <div className="ts-between" style={{ paddingTop: 4 }}>
                  <span className="ts-mini-title">Bot របស់ខ្ញុំ</span>
                  <b className="ts-figure">{bots.limit < 0 ? `${bots.used} / ∞` : `${bots.used} / ${bots.limit}`}</b>
                </div>
                {bots.limit > 0 && <ProgressBar value={(bots.used / bots.limit) * 100} label="Bot របស់ខ្ញុំ" />}
              </>
            )}
          </Card>
        )}
      </section>

      <section className="ts-stack">
        <SectionHeader icon="card" title="គម្រោង & ការទូទាត់" action={!showPlans ? <Button size="sm" variant="ghost" onClick={() => setShowPlans(true)}>ដំឡើងគម្រោង</Button> : undefined} />
        {showPlans ? <Subscription currentPlan={usage?.plan} /> : (
          <Card tone="accent" className="ts-plan-card">
            <span><small>គម្រោងបច្ចុប្បន្ន</small><b>{usage ? usage.plan.toUpperCase() : "—"}</b></span>
            <Button size="sm" variant="secondary" onClick={() => setShowPlans(true)}>មើលគម្រោង</Button>
          </Card>
        )}
      </section>

      <section className="ts-stack">
        <SectionHeader icon="receipt" title="ប្រវត្តិទូទាត់" />
        {paymentsError ? <StateView kind="error" onRetry={loadPayments} /> : !payments ? <ListSkeleton rows={1} /> : payments.length === 0 ? (
          <StateView kind="empty" icon="receipt" title="មិនទាន់មានបង្កាន់ដៃទូទាត់ទេ" description="បង្កាន់ដៃនៃការទូទាត់ នឹងបង្ហាញនៅទីនេះ។" />
        ) : (
          <div className="ts-list">
            {payments.map((p) => {
              const st = PAYMENT_STATUS[p.status] || PAYMENT_STATUS.pending;
              return (
                <div key={p.id} className="ts-list-row">
                  <span className="ts-tile ts-tile-sm ts-tile-tint"><Icon name="receipt" size={18} /></span>
                  <span className="ts-list-text"><b>{p.plan_id.toUpperCase()} · ${Number(p.amount).toFixed(2)}</b><small>{new Date(p.created_at).toLocaleDateString("km-KH")}</small></span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="ts-stack">
        <SectionHeader icon="sliders" title="ការកំណត់" />
        <div className="ts-list">
          <div className="ts-list-row">
            <span className="ts-tile ts-tile-sm ts-tile-tint"><Icon name="languages" size={18} /></span>
            <span className="ts-list-text"><b>ភាសា</b><small>ភាសាខ្មែរ 🇰🇭</small></span>
          </div>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="ts-list-row">
              <span className="ts-tile ts-tile-sm ts-tile-tint"><Icon name={l.icon} size={18} /></span>
              <span className="ts-list-text"><b>{l.label}</b><small>{l.sub}</small></span>
              <Icon name="chevronRight" size={18} />
            </Link>
          ))}
        </div>
      </section>

      <Button variant="danger" block icon="logout" onClick={() => supabase.auth.signOut()}>ចាកចេញ</Button>
    </AppShell>
  );
}
