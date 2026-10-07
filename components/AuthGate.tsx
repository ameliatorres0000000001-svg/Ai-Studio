"use client";

import { useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase-client";
import { useLang } from "@/lib/i18n";
import { BrandIcon } from "@/components/ui";

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
  const { lang, toggle } = useLang();
  const kh = lang === "kh";
  const [started, setStarted] = useState(false);
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

  // "Press Enter to continue" on the welcome screen
  useEffect(() => {
    if (started) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") setStarted(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started]);

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

  const title = mode === "signin" ? (kh ? "ចូលគណនី" : "Sign in") : (kh ? "បង្កើតគណនី" : "Create account");

  return (
    <main className={`auth-screen ${kh ? "lang-kh" : "lang-en"}`}>
      <div className="auth-terminal" role="region" aria-label={title}>
        <div className="auth-titlebar">
          <span className="auth-dot red" />
          <span className="auth-dot yellow" />
          <span className="auth-dot green" />
          <span className="auth-titlebar-name">claude-code-studio</span>
          <button type="button" className="auth-lang" onClick={toggle} aria-label="Switch language">
            <span className={kh ? "on" : ""}>ខ្មែរ</span>
            <i>|</i>
            <span className={!kh ? "on" : ""}>EN</span>
          </button>
        </div>

        <div className="auth-body">
          <div className="auth-chip">
            <span className="auth-asterisk">✻</span>
            {kh ? "សូមស្វាគមន៍មកកាន់ " : "Welcome to "}
            <b>Claude Code</b>
            {kh ? " Studio" : " Studio"}
          </div>

          <PixelLogo />

          {!started ? (
            <div className="auth-welcome">
              <p className="auth-tagline">
                {kh
                  ? "សាងសង់ កែសម្រួល និងបង្ហោះកូដជាមួយ Claude Code — ចាប់ផ្តើមពី GitHub។"
                  : "Build, edit & deploy code with Claude Code — starting from GitHub."}
              </p>
              <button type="button" className="auth-start" onClick={() => setStarted(true)} autoFocus>
                {kh ? "ចាប់ផ្តើម" : "Get started"} <span aria-hidden="true">→</span>
              </button>
              <div className="auth-hint">
                {kh ? "ចុច " : "Press "}
                <kbd>Enter</kbd>
                {kh ? " ដើម្បីបន្ត" : " to continue"}
                <span className="auth-cursor" aria-hidden="true" />
              </div>
            </div>
          ) : (
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <div className="auth-form-title">
                <span className="auth-prompt">›</span> {title}
              </div>

              <label className="auth-field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </label>
              <label className="auth-field">
                <span>{kh ? "ពាក្យសម្ងាត់" : "Password"}</span>
                <input
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>

              {error && <div className="chat-error">{error}</div>}
              {notice && <div className="success-banner">{notice}</div>}

              <button type="submit" className="auth-submit" disabled={busy || !email.trim() || !password}>
                {busy ? (kh ? "កំពុងដំណើរការ…" : "Working…") : mode === "signin" ? (kh ? "ចូល" : "Sign in") : (kh ? "ចុះឈ្មោះ" : "Sign up")}
                <span aria-hidden="true">↵</span>
              </button>
              <button
                type="button"
                className="auth-switch"
                onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
              >
                {mode === "signin" ? (kh ? "បង្កើតគណនីថ្មី" : "Create an account") : (kh ? "មានគណនីរួចហើយ? ចូល" : "Have an account? Sign in")}
              </button>

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
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

/* ── Pixel-block "CLAUDE CODE" wordmark (rendered as SVG, no image asset) ── */
const GLYPHS: Record<string, string[]> = {
  C: ["0111", "1000", "1000", "1000", "0111"],
  L: ["1000", "1000", "1000", "1000", "1111"],
  A: ["0110", "1001", "1111", "1001", "1001"],
  U: ["1001", "1001", "1001", "1001", "0110"],
  D: ["1110", "1001", "1001", "1001", "1110"],
  E: ["1111", "1000", "1110", "1000", "1111"],
  O: ["0110", "1001", "1001", "1001", "0110"],
};

function PixelLogo() {
  const cell = 12;
  const gap = 2;
  const letterGap = 12;
  const shadow = 4;
  const rowH = 5 * cell;
  const lines = ["CLAUDE", "CODE"];
  const lineGap = 18;
  const widthOf = (word: string) => word.length * (4 * cell) + (word.length - 1) * letterGap;
  const width = widthOf(lines[0]) + shadow + 2;
  const height = lines.length * rowH + (lines.length - 1) * lineGap + shadow + 2;

  const rects: { x: number; y: number; key: string }[] = [];
  lines.forEach((word, li) => {
    word.split("").forEach((ch, ci) => {
      GLYPHS[ch].forEach((row, r) => {
        row.split("").forEach((bit, c) => {
          if (bit === "1") {
            rects.push({
              x: ci * (4 * cell + letterGap) + c * cell,
              y: li * (rowH + lineGap) + r * cell,
              key: `${li}-${ci}-${r}-${c}`,
            });
          }
        });
      });
    });
  });
  const size = cell - gap;

  return (
    <svg className="auth-logo" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Claude Code">
      <g fill="none" stroke="#d97848" strokeWidth="1.2" opacity="0.55">
        {rects.map((r) => (
          <rect key={`s-${r.key}`} x={r.x + shadow} y={r.y + shadow} width={size} height={size} />
        ))}
      </g>
      <g fill="#d97848">
        {rects.map((r) => (
          <rect key={r.key} x={r.x} y={r.y} width={size} height={size} />
        ))}
      </g>
    </svg>
  );
}
