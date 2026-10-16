"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase-client";
import { BrandIcon } from "@/components/ui";

type TelegramUser = { id: number; first_name?: string; last_name?: string; username?: string; photo_url?: string; auth_date: number; hash: string };

declare global { interface Window { TelegramLoginWidget?: { dataOnAuth?: (user: TelegramUser) => void } } }

export function TelegramLoginButton({ onError }: { onError?: (message: string) => void }) {
  const ref = useRef<HTMLDivElement>(null); const [config, setConfig] = useState<{ configured: boolean; botUsername: string | null } | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/telegram/login-config").then(r => r.json()).then(setConfig).catch(() => setConfig({ configured: false, botUsername: null })); }, []);
  const auth = useCallback(async (user: TelegramUser) => { setBusy(true); try { const r = await fetch("/api/telegram/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telegramData: user }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error || "Telegram login failed"); const result = await supabase.auth.setSession(data.session); if (result.error) throw result.error; } catch (e) { onError?.(e instanceof Error ? e.message : "Telegram login failed"); } finally { setBusy(false); } }, [onError]);
  useEffect(() => { if (!config?.configured || !config.botUsername || !ref.current) return; window.TelegramLoginWidget = { dataOnAuth: auth }; ref.current.innerHTML = ""; const script = document.createElement("script"); script.async = true; script.src = "https://telegram.org/js/telegram-widget.js?22"; script.setAttribute("data-telegram-login", config.botUsername); script.setAttribute("data-size", "large"); script.setAttribute("data-radius", "8"); script.setAttribute("data-onauth", "TelegramLoginWidget.dataOnAuth(user)"); ref.current.appendChild(script); return () => { if (ref.current) ref.current.innerHTML = ""; }; }, [auth, config]);
  if (!config?.configured || !config.botUsername) return null;
  return <div className="ts-tg-login"><div className="ts-tg-login-label"><BrandIcon name="telegram" size={20} /><span>ចូលជាមួយ Telegram</span></div>{busy && <div className="ts-small ts-muted">កំពុងផ្ទៀងផ្ទាត់ Telegram...</div>}<div ref={ref} className="ts-tg-widget" /></div>;
}
