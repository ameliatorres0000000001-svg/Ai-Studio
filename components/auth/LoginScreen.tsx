"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { AppShell, Button, Card, Field, Icon, Input } from "@/components/ui/primitives";
import { TelegramLoginButton } from "./TelegramLoginButton";

/** 01 Login — Telegram + Google one-tap sign in with the Khmer value and privacy guarantees. */
export function LoginScreen() {
  const params = useSearchParams(); const next = params.get("next") || "/";
  const [showEmail, setShowEmail] = useState(false); const [mode, setMode] = useState<"signin"|"signup">("signin"); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function google() { const { error: authError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } }); if (authError) setError(authError.message); }
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(""); try { if (mode === "signin") { const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (e) throw e; } else { const { data, error: e } = await supabase.auth.signUp({ email: email.trim(), password }); if (e) throw e; if (!data.session) { setNotice("សូមពិនិត្យអ៊ីមែលរបស់អ្នកដើម្បីបញ្ជាក់គណនី"); setMode("signin"); } } } catch (err) { setError(err instanceof Error ? err.message : "Authentication failed"); } finally { setBusy(false); } }

  return (
    <AppShell nav={false} className="ts-login">
      <section className="ts-login-hero">
        <span className="ts-brand-mark"><Icon name="bot" size={34} /></span>
        <span className="ts-pill ts-pill-success"><Icon name="sparkles" size={14} />TeleScripts Agent</span>
        <h1>បង្កើត Bot ក្នុងពេល ៥ នាទី ដោយមិនបាច់ចេះកូដ</h1>
        <p>បង្កើត Telegram Bot ដោយមិនបាច់ចេះសរសេរកូដមួយជួរឡើយ។ ឆ្លើយតបរហ័ស និងវៃឆ្លាតបំផុត។</p>
      </section>

      <div className="ts-values" aria-hidden="true">
        <span className="v1"><Icon name="codeOff" size={18} />0% កូដ</span><i />
        <span className="v2"><Icon name="bolt" size={18} />100% ស្វ័យប្រវត្តិ</span><i />
        <span className="v3"><Icon name="shield" size={18} />កម្មសិទ្ធិផ្តាច់មុខ</span>
      </div>

      <Card className="ts-login-card">
        <h2>ចូលគណនីដោយចុចតែម្តង</h2>
        <TelegramLoginButton onError={setError} />
        <button type="button" className="ts-google" onClick={google}>
          <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.9 1.3-4.2 2-6.8 2-5.2 0-9.6-3.5-11.2-8.2H5.9v5.3A20 20 0 0 0 24 44z"/><path fill="#FBBC05" d="M12.8 27.8a12 12 0 0 1 0-7.6v-5.3H5.9a20 20 0 0 0 0 18.2z"/><path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3l5.8-5.8A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.9 14.9l6.9 5.3C14.4 15.5 18.8 12 24 12z"/></svg>
          ចូលជាមួយ Google
        </button>
        <div className="ts-divider"><span>ឬ</span></div>
        {!showEmail ? (
          <Button variant="ghost" block onClick={() => setShowEmail(true)}>ប្រើ Email ជំនួស</Button>
        ) : (
          <form className="ts-stack" onSubmit={submit}>
            <Field label="Email"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></Field>
            <Field label="ពាក្យសម្ងាត់"><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete={mode === "signin" ? "current-password" : "new-password"} /></Field>
            {notice && <p className="ts-notice">{notice}</p>}
            <Button type="submit" block loading={busy}>{mode === "signin" ? "ចូល" : "ចុះឈ្មោះ"}</Button>
            <Button variant="ghost" block onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "បង្កើតគណនីថ្មី" : "ចូលគណនី"}</Button>
          </form>
        )}
        {error && <div role="alert" className="ts-error">{error}</div>}
      </Card>

      <div className="ts-secure">
        <span className="ts-secure-icon"><Icon name="lock" size={20} /></span>
        <div>
          <strong>សុវត្ថិភាព 100% មិនប៉ះពាល់ទិន្នន័យ</strong>
          <p>ពាក្យសម្ងាត់ និងកូនសោសម្ងាត់មិនត្រូវបានបង្ហាញដល់ AI ឬភាគីទីបីឡើយ។ គ្មានការស្នើសុំលេខកូដសម្ងាត់ ឬ BotFather Token ក្នុងផ្ទាំងជជែកឡើយ។</p>
        </div>
      </div>
    </AppShell>
  );
}
