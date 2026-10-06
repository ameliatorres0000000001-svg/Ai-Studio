"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase-client";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui";

/**
 * Blocks the app until a Supabase session exists. The API routes require the
 * session's access token as a Bearer token, so nothing works without sign-in.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { lang } = useLang();
  const kh = lang === "kh";
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit() {
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) {
          setNotice(kh ? "សូមពិនិត្យអ៊ីមែលរបស់អ្នកដើម្បីបញ្ជាក់គណនី" : "Check your email to confirm your account, then sign in.");
          setMode("signin");
        }
      }
    } catch (e: any) {
      setError(e.message || "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  if (!isSupabaseConfigured) {
    return (
      <main style={{ padding: 32 }}>
        <div className="chat-error">
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. Copy .env.example to .env.local and fill them in.
        </div>
      </main>
    );
  }
  if (session) return <>{children}</>;

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    marginBottom: 10,
    background: "var(--bg-0)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
  } as const;

  return (
    <main className={kh ? "lang-kh" : "lang-en"} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div className="panel" style={{ width: 360, maxWidth: "92vw" }}>
        <div className="panel-header">
          <h3>{mode === "signin" ? (kh ? "ចូលគណនី" : "Sign in") : (kh ? "បង្កើតគណនី" : "Create account")}</h3>
        </div>
        <input
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder={kh ? "ពាក្យសម្ងាត់" : "Password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={inputStyle}
        />
        {error && <div className="chat-error">{error}</div>}
        {notice && <div className="success-banner">{notice}</div>}
        <Button onClick={submit} disabled={busy || !email.trim() || !password} className="btn-block">
          {mode === "signin" ? (kh ? "ចូល" : "Sign in") : (kh ? "ចុះឈ្មោះ" : "Sign up")}
        </Button>
        <Button
          variant="ghost"
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
          className="btn-block"
        >
          {mode === "signin" ? (kh ? "បង្កើតគណនីថ្មី" : "Create an account") : (kh ? "មានគណនីរួចហើយ?" : "Have an account? Sign in")}
        </Button>
      </div>
    </main>
  );
}
