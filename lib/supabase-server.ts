import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

let _adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_adminClient) return _adminClient;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  _adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _adminClient;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getSupabaseAdmin(), prop);
  },
});

export interface AuthUser {
  id: string;
  email: string;
}

export async function getAuthenticatedUser(req: Request): Promise<{
  user: AuthUser | null;
  error: NextResponse | null;
}> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Authentication required", authRequired: true },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.replace("Bearer ", "");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      ),
    };
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser(token);

  if (error || !user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Invalid or expired session", authRequired: true },
        { status: 401 }
      ),
    };
  }

  return {
    user: { id: user.id, email: user.email || "" },
    error: null,
  };
}

export async function getOwnedWorkspace(
  workspaceId: string,
  userId: string
): Promise<{ workspace: any | null; error: NextResponse | null }> {
  const { data: ws, error } = await supabaseAdmin
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !ws) {
    return {
      workspace: null,
      error: NextResponse.json(
        { error: "Workspace not found or access denied" },
        { status: 404 }
      ),
    };
  }

  return { workspace: ws, error: null };
}
