"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase-client";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/dashboard-preview", "/ui-kit"];

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  useEffect(() => {
    if (!isSupabaseConfigured) { setReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (ready && isSupabaseConfigured && !session && !isPublic) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
    }
  }, [isPublic, pathname, ready, router, session]);

  if (isPublic) return <>{children}</>;
  if (!ready || !isSupabaseConfigured || !session) return null;
  return <>{children}</>;
}
