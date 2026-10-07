import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Workspace } from "./types";

// SERVER-ONLY. Never import this file from a client component.

let _adminClient: SupabaseClient | null = null;

function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (_adminClient) return _adminClient;

  const supabaseUrl = getSupabaseUrl();
  // The service-role key is mandatory. We deliberately do NOT fall back to the
  // anon key: that would silently run privileged queries under the wrong role.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Missing Supabase server configuration: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"
    );
  }

  _adminClient = createClient(supabaseUrl, serviceKey, {
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

/**
 * Comma-separated list of emails allowed to use this deployment.
 * All users share the server's single GITHUB_ACCESS_TOKEN and ANTHROPIC_API_KEY,
 * so open sign-up must not translate into access to those credentials.
 * In production an empty list denies everyone (fail closed).
 */
function isEmailAllowed(email: string): boolean {
  const raw = process.env.ALLOWED_USER_EMAILS || "";
  const allowed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) {
    return process.env.NODE_ENV !== "production";
  }
  return allowed.includes(email.toLowerCase());
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

  const token = authHeader.slice("Bearer ".length).trim();

  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Server configuration error: Supabase URL / anon key missing" },
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

  const email = user.email || "";
  if (!isEmailAllowed(email)) {
    return {
      user: null,
      error: NextResponse.json(
        {
          error:
            "This account is not authorised for this deployment. The server admin must add the email to ALLOWED_USER_EMAILS.",
          forbidden: true,
        },
        { status: 403 }
      ),
    };
  }

  return { user: { id: user.id, email }, error: null };
}

/** Fetch a workspace row only if it belongs to the user. */
export async function getOwnedWorkspace(
  workspaceId: string,
  userId: string
): Promise<
  | { workspace: Workspace; error: null }
  | { workspace: null; error: NextResponse }
> {
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

  return { workspace: ws as Workspace, error: null };
}

/** Remove server-internal fields before sending a workspace to the browser. */
export function toPublicWorkspace(ws: Workspace): Omit<Workspace, "local_path"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { local_path, ...rest } = ws;
  return rest;
}
