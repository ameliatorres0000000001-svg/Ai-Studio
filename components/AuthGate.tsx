"use client";

import { useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase-client";
import { useLang } from "@/lib/i18n";
import { Button, BrandIcon } from "@/components/ui";

declare global {
  interface Window {
    TelegramLoginWidget?: {
      dataOnAuth?: (user: TelegramWidgetUser) => void;
    };
  }
}

interface TelegramWidgetUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginConfig {
  configured: boolean;
  botUsername: string | null;
}

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
  const [tgConfig, setTgConfig] = useState<TelegramLoginConfig | null>(null);
  const [tgBusy, setTgBusy] = useState(false);
  const [tgError, setTgError] = useState<string | null>(null);
  const tgWidgetRef = useRef<HTMLDivElement>(null);

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

  // Fetch Telegram login config (bot username for the widget)
  useEffect(() => {
    fetch("/api/telegram/login-config")
      .then((r) => r.json())
      .then((data: TelegramLoginConfig) => setTgConfig(data))
      .catch(() => setTgConfig({ configured: false, botUsername: null }));
  }, []);

  // Set up Telegram Login Widget callback
  const handleTelegramAuth = useCallback(async (user: TelegramWidgetUser) => {
    setTgBusy(true);
    setTgError(null);
    try {
      const res = await fetch("/api/telegram/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramData: user }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Telegram login failed");
      }
      // Set the session in Supabase from the server-issued tokens
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (sessionError) throw sessionError;
      // onAuthStateChange will pick this up and set the session
    } catch (e: any) {
      setTgError(e.message || "Telegram login failed");
    } finally {
      setTgBusy(false);
    }
  }, []);

  // Load Telegram widget script and render the widget
  useEffect(() => {
    if (!tgConfig?.configured || !tgConfig?.botUsername || !tgWidgetRef.current) return;

    // Set up the global callback for the Telegram widget
    window.TelegramLoginWidget = {
      dataOnAuth: handleTelegramAuth,
    };

    // Clear any existing widget
    tgWidgetRef.current.innerHTML = "";

    // Create the Telegram Login Widget script
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", tgConfig.botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-onauth", "TelegramLoginWidget.dataOnAuth(user)");
    script.setAttribute("data-request-access", "write");

    tgWidgetRef.current.appendChild(script);

    return () => {
      if (tgWidgetRef.current) tgWidgetRef.current.innerHTML = "";
    };
  }, [tgConfig, handleTelegramAuth]);

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

        {tgConfig?.configured && (
          <>
            <div className="auth-divider">
              <span>{kh ? "ឬ" : "or"}</span>
            </div>

            <div className="telegram-login-section">
              <div className="telegram-login-label">
                <BrandIcon name="telegram" size={18} />
                <span>{kh ? "ចូលជាមួយ Telegram" : "Sign in with Telegram"}</span>
              </div>
              {tgBusy && (
                <div className="chat-loading">
                  <div className="spinner" />
                  {kh ? "កំពុងផ្ទៀងផ្ទាត់ Telegram..." : "Verifying Telegram..."}
                </div>
              )}
              {tgError && <div className="chat-error">{tgError}</div>}
              <div ref={tgWidgetRef} className="telegram-widget-container" />
              {!tgConfig.botUsername && (
                <p className="connector-meta" style={{ marginTop: 8 }}>
                  {kh
                    ? "Bot username មិនអាចដំណើរការបានទេ។ សូមពិនិត្យ TELEGRAM_BOT_TOKEN លើ server។"
                    : "Bot username could not be loaded. Check TELEGRAM_BOT_TOKEN on the server."}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
