"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase-client";
import { useLang } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Badge, Button, Panel, StatusBadge, BrandIcon } from "@/components/ui";

interface HealthState {
  github: boolean;
  claude: boolean;
  vercel: boolean;
  supabase: boolean;
}

interface SampleProject {
  name: string;
  stack: string;
  updated: string;
}

const SAMPLE_PROJECTS: SampleProject[] = [
  { name: "My Website", stack: "Website • Next.js • Tailwind", updated: "2" },
  { name: "Telegram Bot", stack: "Bot • Python", updated: "3" },
  { name: "Mini App", stack: "Mini App • Next.js", updated: "5" },
  { name: "Portfolio Website", stack: "Website • HTML • CSS", updated: "7" },
];

type FeatureCardDef = {
  key: string;
  title: { kh: string; en: string };
  subtitle: { kh: string; en: string };
  icon: "telegram" | "plug";
  color: string;
  href: string | null;
};

const FEATURE_CARDS: FeatureCardDef[] = [
  {
    key: "telegram",
    title: { kh: "Telegram Bot Builder", en: "Telegram Bot Builder" },
    subtitle: { kh: "បង្កើត Bot លើ Telegram", en: "Build a bot on Telegram" },
    icon: "telegram",
    color: "#2aabee",
    href: "/bot-builder",
  },
  {
    key: "website",
    title: { kh: "Website Builder", en: "Website Builder" },
    subtitle: { kh: "បង្កើត Website ដោយខ្លួនឯង", en: "Build a website yourself" },
    icon: "plug",
    color: "#6366f1",
    href: null,
  },
  {
    key: "miniapp",
    title: { kh: "Mini App Builder", en: "Mini App Builder" },
    subtitle: { kh: "បង្កើត Mini App / កម្មវិធី", en: "Build a Mini App / tool" },
    icon: "plug",
    color: "#10b981",
    href: null,
  },
  {
    key: "webapp",
    title: { kh: "Web App Builder", en: "Web App Builder" },
    subtitle: { kh: "បង្កើត Web Application", en: "Build a web application" },
    icon: "plug",
    color: "#f97316",
    href: null,
  },
];

export function PublicDashboard() {
  const { lang } = useLang();
  const kh = lang === "kh";
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [health, setHealth] = useState<HealthState | null>(null);
  const [projectCount, setProjectCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoggedIn(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setLoggedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loggedIn) {
      setHealth(null);
      setProjectCount(null);
      return;
    }
    api.health().then(setHealth).catch(() => setHealth(null));
    api.listWorkspaces().then((r) => setProjectCount(r.workspaces.length)).catch(() => setProjectCount(null));
  }, [loggedIn]);

  const t = (khText: string, enText: string) => (kh ? khText : enText);
  const isMember = loggedIn === true;

  return (
    <div className="agent-dashboard">
      <section className="agent-hero" aria-labelledby="agent-dashboard-title">
        <div className="agent-hero-copy">
          <div className="agent-eyebrow">✦ {t("AGENT BUILDER AI", "AGENT BUILDER AI")}</div>
          <h1 id="agent-dashboard-title">
            {t("បង្កើតអ្វីដែលអ្នកស្រមៃ ដោយមិនចាំបាច់ចាប់ផ្ដើមពីសូន្យ", "Turn an idea into a working product.")}
          </h1>
          <p>
            {t(
              "ពិពណ៌នាអ្វីដែលអ្នកចង់បាន ហើយចាប់ផ្ដើមពី template ដែលត្រូវនឹងគោលដៅរបស់អ្នក។",
              "Describe what you want, choose a starting template, and let your builder do the heavy lifting."
            )}
          </p>
          <div className="agent-hero-actions">
            <Link href="/bot-builder"><Button>{t("ចាប់ផ្ដើមបង្កើត Bot", "Start building a bot")} <span aria-hidden="true">→</span></Button></Link>
            <span className="agent-hero-note">{t("ចាប់ផ្ដើមជាមួយ Telegram · មិនចាំបាច់ចេះ code", "Start with Telegram · no coding required")}</span>
          </div>
        </div>
        <div className="agent-hero-orbit" aria-hidden="true">
          <span>✦</span><i>AI</i><b>⌁</b>
        </div>
      </section>

      <div className="agent-section-heading">
        <div>
          <span className="agent-eyebrow">{t("ចាប់ផ្ដើមរហ័ស", "QUICK START")}</span>
          <h2>{t("ជ្រើសរើសអ្វីដែលអ្នកចង់បង្កើត", "Choose what you want to build")}</h2>
        </div>
        <span className="agent-muted">{t("១ template កំពុងដំណើរការ", "1 template available")}</span>
      </div>

      <section className="agent-template-grid" aria-label={t("Templates", "Templates")}>
        {FEATURE_CARDS.map((card) => <FeatureCard key={card.key} def={card} kh={kh} />)}
      </section>

      <div className="agent-content-grid">
        <Panel title={t("ស្ថានភាព workspace", "Workspace status")} className="agent-status-panel">
          <div className="agent-status-summary">
            <span className={`agent-status-pulse ${isMember ? "on" : "demo"}`} />
            <div>
              <strong>{isMember ? t("Workspace របស់អ្នករួចរាល់", "Your workspace is ready") : t("កំពុងមើលជា Demo", "You are viewing demo mode")}</strong>
              <p>{isMember ? t(`អ្នកមាន ${projectCount ?? 0} គម្រោង`, `You have ${projectCount ?? 0} project(s)`) : t("ចូលគណនី ដើម្បីចាប់ផ្ដើមបង្កើត Bot ពិតប្រាកដ។", "Sign in to start building real projects.")}</p>
            </div>
          </div>
          {isMember && health && (
            <div className="agent-admin-hint">
              <span>{t("ការតភ្ជាប់ស្នូលត្រូវបានគ្រប់គ្រងដោយអ្នកគ្រប់គ្រង", "Core connections are managed by admins")}</span>
              <StatusBadge status="connected" label={t("គណនីបានភ្ជាប់", "Account connected")} />
            </div>
          )}
          {!isMember && <p className="agent-panel-note">{t("ទិន្នន័យខាងក្រោមជាទិន្នន័យគំរូសម្រាប់មើលជាមុនប៉ុណ្ណោះ។", "The content below is sample data for preview only.")}</p>}
        </Panel>

        <Panel title={t("គម្រោងគំរូ", "Example projects")} className="agent-project-panel">
          {isMember ? (
            <div className="agent-empty-projects">
              <strong>{t(`អ្នកមាន ${projectCount ?? 0} គម្រោង`, `You have ${projectCount ?? 0} project(s)`)}</strong>
              <span>{t("បើក Bot Builder ដើម្បីបង្កើតគម្រោងថ្មី។", "Open Bot Builder to create a new project.")}</span>
            </div>
          ) : (
            <div className="agent-project-list">
              {SAMPLE_PROJECTS.map((project) => (
                <div key={project.name} className="agent-project-row">
                  <span className="agent-project-icon">◇</span>
                  <div><strong>{project.name}</strong><span>{project.stack}</span></div>
                  <Badge variant="neutral">{t("គំរូ", "sample")}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title={t("ជំហានបន្ទាប់", "Your next steps")} className="agent-steps-panel">
        <div className="agent-steps">
          <div className="agent-step active"><span>1</span><div><strong>{t("ជ្រើសរើស template", "Choose a template")}</strong><small>{t("ចាប់ផ្ដើមពី Telegram Bot Builder", "Start with Telegram Bot Builder")}</small></div></div>
          <div className="agent-step"><span>2</span><div><strong>{t("ប្រាប់អំពីគំនិតរបស់អ្នក", "Describe your idea")}</strong><small>{t("Bot Builder នឹងសួរសំណួរដែលចាំបាច់", "Bot Builder asks the important questions")}</small></div></div>
          <div className="agent-step"><span>3</span><div><strong>{t("ទទួលបាន repo រួចរាល់", "Get a ready repo")}</strong><small>{t("ពិនិត្យ ហើយ deploy នៅពេលរួចរាល់", "Review it, then deploy when ready")}</small></div></div>
        </div>
        <Link href="/bot-builder" className="agent-step-cta">{t("បើក Bot Builder", "Open Bot Builder")} →</Link>
      </Panel>
    </div>
  );
}

function FeatureCard({ def, kh }: { def: FeatureCardDef; kh: boolean }) {
  const title = kh ? def.title.kh : def.title.en;
  const subtitle = kh ? def.subtitle.kh : def.subtitle.en;
  const body = (
    <div className={`agent-template-card ${def.href ? "available" : "coming-soon"}`} style={{ "--card-accent": def.color } as CSSProperties}>
      <div className="agent-template-icon">{def.icon === "telegram" ? <BrandIcon name="telegram" size={22} /> : "◆"}</div>
      <div className="agent-template-copy"><strong>{title}</strong><span>{subtitle}</span></div>
      {def.href ? <span className="agent-card-arrow" aria-hidden="true">→</span> : <Badge variant="neutral">{kh ? "ឆាប់ៗនេះ" : "Coming soon"}</Badge>}
    </div>
  );
  return def.href ? <Link href={def.href} aria-label={`${title} — ${subtitle}`}>{body}</Link> : body;
}
