"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { AppShell, Icon, SectionHeader, Textarea, Toast, useSpeechInput } from "@/components/ui/primitives";
import { BotProjects, useBotProjects } from "@/components/BotProjects";

const PROMPT_PLACEHOLDER = "ប្រាប់ខ្ញុំថាអ្នកចង់បាន bot អ្វី... (ឧទាហរណ៍៖ ខ្ញុំចង់បាន bot លក់កាហ្វេ និងទទួលការកុម្ម៉ង់)";

const STARTERS = [
  { emoji: "🛍️", title: "Bot លក់ទំនិញ", sub: "កាតាឡុកទំនិញ & គិតលុយ", prompt: "ខ្ញុំចង់បង្កើត Bot លក់ទំនិញតាម Telegram ដែលមានកាតាឡុក និងប្រព័ន្ធគិតលុយ ABA KHQR" },
  { emoji: "💬", title: "ឆ្លើយសំណួរ 24/7", sub: "ឆ្លើយតបឆ្លាតវៃជាមួយ AI", prompt: "ខ្ញុំចង់បង្កើត Bot ឆ្លើយសំណួរអតិថិជន ២៤/៧ ដោយប្រើទិន្នន័យផលិតផលរបស់ខ្ញុំ" },
  { emoji: "📅", title: "Bot កក់ម៉ោង", sub: "ណាត់ជួប និងកក់កន្លែង", prompt: "ខ្ញុំត្រូវការ Bot សម្រាប់ទទួលការកក់ម៉ោងសេវាកម្ម កំណត់ម៉ោងណាត់ជួប និងរំលឹកអតិថិជន" },
  { emoji: "📱", title: "Telegram Mini App", sub: "ហាងទំនើបក្នុង Telegram", prompt: "បង្កើត Telegram Mini App ពេញលេញសម្រាប់ហាងទំនិញ ដោយមាន Cart និងបញ្ជាក់ទីតាំង" },
];

/** Brand header shared by the tab screens (Home, My bots, Help, Account). */
export function BrandHeader() {
  const [plan, setPlan] = useState<string | null>(null);
  useEffect(() => { api.getUsage().then((u) => setPlan(u.plan)).catch(() => setPlan(null)); }, []);
  return (
    <header className="ui-topbar">
      <div className="ui-topbar-inner">
        <Link href="/" className="ts-brand" aria-label="TeleScripts">
          <span className="ts-brand-mark"><Icon name="bot" size={22} /></span>
          <span>
            <span className="ts-brand-name" style={{ color: "var(--color-text-primary)" }}>TeleScripts{plan && plan !== "free" && <span className="ts-brand-plan">{plan.toUpperCase()}</span>}</span>
            <span className="ts-brand-status"><span className="ui-status-dot ui-dot-green ui-pulse" />សកម្ម (Active)</span>
          </span>
        </Link>
        <Link href="/settings" className="ts-avatar-link" aria-label="គណនី"><span className="ui-avatar" style={{ width: 32, height: 32 }}><Icon name="person" size={18} /></span></Link>
      </div>
    </header>
  );
}

/**
 * 02 Home — prompt composer, voice input, 4 quick starters, recent projects.
 * Submitting hands the prompt to the Builder chat (/bot-builder?prompt=…).
 */
export function Dashboard() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bots = useBotProjects();
  const voice = useSpeechInput((text) => setPrompt((p) => (p ? `${p} ${text}` : text)), setToast);
  const listening = voice.listening;

  function applyPrompt(text: string) {
    setPrompt(text);
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function submit() {
    const text = prompt.trim();
    if (!text) { inputRef.current?.focus(); return; }
    router.push(`/bot-builder?prompt=${encodeURIComponent(text)}`);
  }

  return (
    <AppShell header={<BrandHeader />}>
      <section className="ts-greet">
        <span className="ts-pill ts-pill-success"><Icon name="sparkles" size={16} />AI Bot Architect</span>
        <h1>ជម្រាបសួរ! តើអ្នកចង់បង្កើត Bot អ្វីថ្ងៃនេះ?</h1>
        <p>បង្កើត Telegram Bot ដោយមិនបាច់ចេះសរសេរកូដមួយជួរឡើយ។ ឆ្លើយតបរហ័ស និងវៃឆ្លាតបំផុត។</p>
      </section>

      <form className="ts-composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="ts-composer-top">
          <span className="ts-tile ts-tile-tint"><Icon name="brain" size={20} /></span>
          <Textarea
            ref={inputRef}
            bare
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
            placeholder={listening ? "កំពុងស្តាប់សម្លេងរបស់អ្នក... (និយាយឥឡូវនេះ)" : PROMPT_PLACEHOLDER}
            aria-label="ប្រាប់ខ្ញុំថាអ្នកចង់បាន bot អ្វី"
          />
        </div>
        <div className="ts-composer-actions">
          <button type="button" className={`ts-mic${listening ? " listening" : ""}`} onClick={voice.toggle} aria-pressed={listening}>
            <span className="ts-ping" aria-hidden="true" />
            <Icon name="mic" size={19} />
            <span>សម្លេង</span>
          </button>
          <div className="ts-row" style={{ gap: 4 }}>
            {/* TODO(backend): file attachments for the builder are not supported by /api/bot-builder/chat yet. */}
            <button type="button" className="ui-icon-btn" title="បន្ថែមឯកសារ" aria-label="បន្ថែមឯកសារ" onClick={() => setToast("ការភ្ជាប់ឯកសារនឹងមកដល់ឆាប់ៗនេះ។")}><Icon name="paperclip" size={22} /></button>
            <button type="submit" className="ts-send" disabled={!prompt.trim()}><span>បង្កើត Bot</span><Icon name="arrowUp" size={18} /></button>
          </div>
        </div>
      </form>

      <div className="ts-values">
        <span className="v1"><Icon name="codeOff" size={18} />0% កូដ</span><i aria-hidden="true" />
        <span className="v2"><Icon name="bolt" size={18} />100% ស្វ័យប្រវត្តិ</span><i aria-hidden="true" />
        <span className="v3"><Icon name="shield" size={18} />កម្មសិទ្ធិផ្តាច់មុខ</span>
      </div>

      <section className="ts-stack">
        <SectionHeader icon="lightbulb" title="គំរូពេញនិយម (Quick Starters)" action={<span className="ts-micro ts-variant" style={{ fontWeight: 500 }}>ចុចដើម្បីជ្រើស</span>} />
        <div className="ts-starters">
          {STARTERS.map((s) => (
            <button key={s.title} type="button" className="ts-starter" onClick={() => applyPrompt(s.prompt)}>
              <b><span className="ts-emoji" aria-hidden="true">{s.emoji}</span><span>{s.title}</span></b>
              <em>{s.sub}</em>
            </button>
          ))}
        </div>
      </section>

      <section className="ts-stack">
        <SectionHeader
          icon="folder"
          title="គម្រោងថ្មីៗរបស់អ្នក"
          action={bots.state === "ready" && bots.projects.length > 0 ? <Link href="/bot-builder/bots" className="ts-link">មើលទាំងអស់ ({bots.projects.length.toLocaleString("km-KH")})</Link> : undefined}
        />
        <BotProjects {...bots} limit={2} />
      </section>

      <section className="ts-community">
        <div className="ts-stack" style={{ gap: 4 }}>
          <small><Icon name="headset" size={18} />សហគមន៍កម្ពុជា</small>
          <h4>ត្រូវការជំនួយបច្ចេកទេស?</h4>
          {/* TODO(backend): real community size and Telegram channel link. */}
          <p>ចូលរួមជាមួយអ្នកបង្កើត Bot ជាង 2,400 នាក់</p>
        </div>
        <Link href="/help"><span>ចូលរួម</span><Icon name="send" size={16} /></Link>
      </section>

      <Toast open={!!toast} message={toast} onClose={() => setToast(null)} />
    </AppShell>
  );
}
