"use client";

import { useEffect, useState } from "react";
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
  icon: string;
  color: string;
  href: string | null; // null = not built yet
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

/**
 * Public entry point (/dashboard — see AuthGate's PUBLIC_PATHS). Anyone can
 * open and browse it; no Supabase session is required. Real data only shows
 * up once a session exists — otherwise every panel falls back to clearly
 * labeled sample content and a "Demo Mode" badge, same spirit as the
 * reference screenshot. Clicking a feature card that needs real credentials
 * (Telegram Bot Builder → /bot-builder) is what triggers the actual login
 * screen, via the existing AuthGate on that route.
 */
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

  return (
    <div className="dashboard">
      <header className="dashboard-hero">
        <div>
          <h1>{t("ផ្ទាំងគ្រប់គ្រង", "Dashboard")}</h1>
          <p>{t("បង្កើត Bot, Mini App, និង Website ដោយគ្រាន់តែនិយាយអ្វីដែលចង់បាន។", "Build bots, mini apps and websites just by describing what you want.")}</p>
        </div>
        {loggedIn === false && <Badge variant="warning">{t("Demo Mode — មិនមាន connection ពិតប្រាកដ", "Demo Mode — no real connections")}</Badge>}
        {loggedIn === true && <Badge variant="success">{t("បានចូលគណនី", "Signed in")}</Badge>}
      </header>

      <section className="dashboard-cards">
        {FEATURE_CARDS.map((c) => (
          <FeatureCard key={c.key} def={c} kh={kh} />
        ))}
      </section>

      <div className="dashboard-columns">
        <Panel title={t("ការភ្ជាប់ (Connections)", "Connections")} className="dashboard-connections">
          <ConnectionRow label="GitHub" connected={!!health?.github} />
          <ConnectionRow label="Claude" connected={!!health?.claude} />
          <ConnectionRow label="Supabase" connected={!!health?.supabase} />
          <ConnectionRow label="Telegram" connected={loggedIn === true} />
          {loggedIn === false && (
            <p className="connector-meta" style={{ marginTop: 8 }}>
              {t("ចុច card ខាងលើ ដើម្បីចូលគណនី និងភ្ជាប់ពិតប្រាកដ។", "Click a card above to sign in and connect for real.")}
            </p>
          )}
        </Panel>

        <Panel title={t("គម្រោងរបស់ខ្ញុំ", "My Projects")} className="dashboard-projects">
          {loggedIn === true ? (
            <p>{t(`អ្នកមាន ${projectCount ?? 0} គម្រោង`, `You have ${projectCount ?? 0} project(s)`)}</p>
          ) : (
            <>
              {SAMPLE_PROJECTS.map((p) => (
                <div key={p.name} className="dashboard-project-row">
                  <div>
                    <div className="dashboard-project-name">{p.name}</div>
                    <div className="dashboard-project-stack">{p.stack}</div>
                  </div>
                  <Badge variant="neutral">{t("គំរូ", "sample")}</Badge>
                </div>
              ))}
            </>
          )}
        </Panel>
      </div>

      <Panel title={t("ជំហានចាប់ផ្តើម", "Getting started")} className="dashboard-getting-started">
        <ol>
          <li>{t("ជ្រើសរើសប្រភេទគម្រោង (ឧ. Telegram Bot Builder)", "Pick a project type (e.g. Telegram Bot Builder)")}</li>
          <li>{t("ចូលគណនីតាម Telegram ពេលចុចបើក", "Sign in with Telegram when prompted")}</li>
          <li>{t("ប្រាប់ពី Bot ដែលអ្នកចង់បាន ជាភាសាធម្មតា", "Describe the bot you want in plain language")}</li>
          <li>{t("ទទួលបាន repo រួចរាល់ ហើយ deploy", "Get a ready-made repo and deploy it")}</li>
        </ol>
        <Link href="/bot-builder">
          <Button>{t("ចាប់ផ្តើមឥឡូវនេះ →", "Get started now →")}</Button>
        </Link>
      </Panel>
    </div>
  );
}

function FeatureCard({ def, kh }: { def: FeatureCardDef; kh: boolean }) {
  const title = kh ? def.title.kh : def.title.en;
  const subtitle = kh ? def.subtitle.kh : def.subtitle.en;
  const body = (
    <div className="dashboard-feature-card" style={{ borderTopColor: def.color }}>
      <div className="dashboard-feature-icon" style={{ background: def.color }}>
        {def.icon === "telegram" ? <BrandIcon name="telegram" size={22} /> : "◆"}
      </div>
      <div className="dashboard-feature-title">{title}</div>
      <div className="dashboard-feature-subtitle">{subtitle}</div>
      {def.href ? (
        <span className="dashboard-feature-cta">{kh ? "ចុចដើម្បីចាប់ផ្តើម →" : "Click to start →"}</span>
      ) : (
        <Badge variant="neutral">{kh ? "ឆាប់ៗនេះ" : "Coming soon"}</Badge>
      )}
    </div>
  );
  return def.href ? <Link href={def.href}>{body}</Link> : body;
}

function ConnectionRow({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div className="dashboard-connection-row">
      <span>{label}</span>
      <StatusBadge status={connected ? "connected" : "disconnected"} />
    </div>
  );
}
