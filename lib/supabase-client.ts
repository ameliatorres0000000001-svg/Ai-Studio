import { createClient } from "@supabase/supabase-js";

// Browser client. Uses ONLY the public anon key; data access is enforced by RLS
// and by the server API routes. The service-role key must never appear here.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Placeholders only keep `next build` from crashing when env vars are absent;
// AuthGate shows a configuration error instead of attempting any request.
export const supabase = createClient(
  supabaseUrl || "https://not-configured.invalid",
  supabaseAnonKey || "not-configured"
);
