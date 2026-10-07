import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  isTelegramConfigured,
} from "@/lib/telegram";
import {
  verifyTelegramAuth,
  isTelegramUserAllowed,
  telegramEmail,
  TelegramAuthError,
} from "@/lib/telegram-auth";
import { errorResponse } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

/**
 * Verifies Telegram Login Widget data, then signs in (or creates) the corresponding
 * Supabase user. Uses the service-role client to look up / create the user, then
 * issues a session by signing in with the deterministic email + a long random password
 * that the user never sees.
 *
 * Body: { telegramData: Record<string, string> }
 */
export async function POST(req: Request) {
  if (!isTelegramConfigured()) {
    return NextResponse.json(
      {
        error: "Telegram bot token is not configured on the server",
        setupRequired: true,
        envVars: ["TELEGRAM_BOT_TOKEN"],
      },
      { status: 400 }
    );
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return NextResponse.json(
      { error: "Server configuration error: Supabase credentials missing" },
      { status: 500 }
    );
  }

  let body: { telegramData?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const telegramData = body.telegramData;
  if (!telegramData || typeof telegramData !== "object") {
    return NextResponse.json(
      { error: "telegramData is required" },
      { status: 400 }
    );
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;

  let authData;
  try {
    authData = verifyTelegramAuth(botToken, telegramData);
  } catch (e) {
    const msg =
      e instanceof TelegramAuthError
        ? e.message
        : "Telegram authentication verification failed";
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  if (!isTelegramUserAllowed(authData.id)) {
    return NextResponse.json(
      {
        error:
          "This Telegram account is not authorised for this deployment. The server admin must add the Telegram user ID to TELEGRAM_ALLOWED_USER_IDS.",
        forbidden: true,
      },
      { status: 403 }
    );
  }

  const email = telegramEmail(authData.id);
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Check if user already exists by email.
  const {
    data: { users },
    error: listError,
  } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    return NextResponse.json(
      { error: "Could not query existing users" },
      { status: 500 }
    );
  }

  let existingUser = users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  // Deterministic password: the user never sees or types it. It is derived
  // from the bot token + telegram id so it is stable across sessions but
  // not guessable without the server-side bot token.
  const crypto = await import("crypto");
  const password = crypto
    .createHmac("sha256", botToken)
    .update(`password:${authData.id}`)
    .digest("hex");

  if (!existingUser) {
    // Create the user with email confirmation already done.
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          telegram_id: authData.id,
          telegram_username: authData.username ?? null,
          first_name: authData.first_name ?? null,
          last_name: authData.last_name ?? null,
          auth_provider: "telegram",
        },
      });

    if (createError || !created.user) {
      return NextResponse.json(
        { error: createError?.message || "Could not create user" },
        { status: 500 }
      );
    }
    existingUser = created.user;
  } else {
    // Ensure the password is set (in case the user was created without one).
    const { error: updateError } = await admin.auth.admin.updateUserById(
      existingUser.id,
      { password, email_confirm: true }
    );
    if (updateError) {
      // Non-fatal: the existing password may still work.
    }
  }

  // Sign in with the anon client to get a real session (access + refresh token).
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signInData, error: signInError } =
    await userClient.auth.signInWithPassword({
      email,
      password,
    });

  if (signInError || !signInData.session) {
    return NextResponse.json(
      { error: signInError?.message || "Could not create a session" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    session: {
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      expires_in: signInData.session.expires_in,
      expires_at: signInData.session.expires_at,
      token_type: signInData.session.token_type,
      user: {
        id: signInData.user.id,
        email: signInData.user.email ?? email,
      },
    },
    telegramUser: {
      id: authData.id,
      username: authData.username ?? null,
      first_name: authData.first_name ?? null,
    },
  });
}
