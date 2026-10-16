import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { isBotSpec } from "@/lib/bot-builder/types";
import { checkBotLimit } from "@/lib/entitlements";
import { requireBuilderUser } from "@/lib/builder/access";
import { supabaseStore, toPublicProject } from "@/lib/builder/store";
import { templateFor } from "@/lib/builder/template-content";
import { errorResponse } from "@/lib/route-helpers";
import type { ProjectRow } from "@/lib/builder/types";

export const dynamic = "force-dynamic";

const MAX_SPEC_BYTES = 50_000;

/** The signed-in user's bots, newest first (no secrets). */
export async function GET(req: Request) {
  const { user, error } = await requireBuilderUser(req);
  if (error) return error;
  try {
    const { data, error: dbError } = await supabaseAdmin
      .from("builder_projects")
      .select("*")
      .eq("user_id", user!.id)
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .limit(50);
    if (dbError) throw new Error(dbError.message);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const projects = await Promise.all(
      ((data as ProjectRow[]) || []).map(async (p) => {
        const [instance, run] = await Promise.all([supabaseStore.getInstance(p.id), supabaseStore.latestRun(p.id)]);
        let ordersToday = 0;
        if (instance) {
          const { count } = await supabaseAdmin.from("bot_orders").select("id", { count: "exact", head: true }).eq("bot_id", instance.id).gte("created_at", since.toISOString());
          ordersToday = count ?? 0;
        }
        return { ...toPublicProject(p, instance, run), ordersToday };
      })
    );
    return NextResponse.json({ projects });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Saves the requirements collected by the chat (step 1). Enforces the plan's bot limit. */
export async function POST(req: Request) {
  const { user, error } = await requireBuilderUser(req);
  if (error) return error;
  try {
    const raw = await req.text();
    if (raw.length > MAX_SPEC_BYTES) return NextResponse.json({ error: "Requirements are too large" }, { status: 413 });
    const body = JSON.parse(raw || "{}");
    if (!isBotSpec(body.spec)) return NextResponse.json({ error: "A valid spec is required" }, { status: 400 });

    const limit = await checkBotLimit(user!.id, user!.email);
    if (!limit.allowed) return NextResponse.json({ error: limit.messageEn, messageKh: limit.messageKh, limit: limit.limit }, { status: 429 });

    const spec = body.spec;
    const { data, error: dbError } = await supabaseAdmin
      .from("builder_projects")
      .insert({ user_id: user!.id, name: String(spec.bot_name).trim().slice(0, 200) || "My bot", template: templateFor(spec), requirements: { spec } })
      .select("*")
      .single();
    if (dbError || !data) throw new Error(dbError?.message || "Could not save the project");
    await supabaseStore.audit({ actor: `user:${user!.id}`, project_id: data.id, action: "project.create", detail: String(spec.bot_name).slice(0, 200) });
    return NextResponse.json({ project: toPublicProject(data as ProjectRow, null, null) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
