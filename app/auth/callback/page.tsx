"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";
export default function AuthCallbackPage() { const router = useRouter(); const params = useSearchParams(); const next = params.get("next") || "/"; const [error, setError] = useState(""); useEffect(() => { let active = true; supabase.auth.getSession().then(({ data, error: e }) => { if (!active) return; if (e) setError(e.message); else if (data.session) router.replace(next); }); const { data } = supabase.auth.onAuthStateChange((event, session) => { if (event === "SIGNED_IN" && session) router.replace(next); }); return () => { active = false; data.subscription.unsubscribe(); }; }, [next, router]); return <main className="auth-callback"><div>{error ? <><p role="alert">{error}</p><Link href="/login">ត្រឡប់ទៅចូលគណនី</Link></> : <><span className="spinner" /><p>កំពុងចូល...</p></>}</div></main>; }
