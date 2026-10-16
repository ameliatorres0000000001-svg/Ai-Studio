import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { requireBuilderUser, getOwnedProject } from "@/lib/builder/access";
import { supabaseStore } from "@/lib/builder/store";
import { errorResponse } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  // Neutralise spreadsheet formulas and quote everything.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * Owner dashboard data for one bot: orders, customer/product counts and the
 * build log. Scoped server-side to this project's bot_id. `?format=csv`
 * exports orders + customers (09 ownership: the data is the owner's).
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { user, error } = await requireBuilderUser(req);
  if (error) return error;
  try {
    const { project, error: ownError } = await getOwnedProject(params.id, user!.id);
    if (ownError) return ownError;
    const instance = await supabaseStore.getInstance(project!.id);
    const run = await supabaseStore.latestRun(project!.id);
    const events = run ? (await supabaseStore.listEvents(run.id)).slice(-200) : [];
    if (!instance) return NextResponse.json({ orders: [], customers: 0, products: 0, ordersToday: 0, events });

    const format = new URL(req.url).searchParams.get("format");
    if (format === "csv") {
      const [{ data: orders }, { data: customers }] = await Promise.all([
        supabaseAdmin.from("bot_orders").select("created_at, product, amount, currency, status, customer_telegram_id, details").eq("bot_id", instance.id).order("created_at", { ascending: false }).limit(5000),
        supabaseAdmin.from("bot_customers").select("created_at, telegram_user_id, username, first_name").eq("bot_id", instance.id).limit(5000),
      ]);
      const lines = ["type,created_at,product,amount,currency,status,telegram_user_id,username,first_name,details"];
      for (const o of orders || []) lines.push(["order", o.created_at, o.product, o.amount, o.currency, o.status, o.customer_telegram_id, "", "", o.details].map(csvCell).join(","));
      for (const c of customers || []) lines.push(["customer", c.created_at, "", "", "", "", c.telegram_user_id, c.username, c.first_name, ""].map(csvCell).join(","));
      return new Response(`﻿${lines.join("\n")}\n`, {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="bot-${project!.id.slice(0, 8)}.csv"`, "Cache-Control": "no-store" },
      });
    }

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const [orders, customers, products, today] = await Promise.all([
      supabaseAdmin.from("bot_orders").select("id, created_at, product, amount, currency, status, customer_telegram_id").eq("bot_id", instance.id).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("bot_customers").select("id", { count: "exact", head: true }).eq("bot_id", instance.id),
      supabaseAdmin.from("bot_products").select("id", { count: "exact", head: true }).eq("bot_id", instance.id),
      supabaseAdmin.from("bot_orders").select("id", { count: "exact", head: true }).eq("bot_id", instance.id).gte("created_at", since.toISOString()),
    ]);
    return NextResponse.json({ orders: orders.data || [], customers: customers.count ?? 0, products: products.count ?? 0, ordersToday: today.count ?? 0, events });
  } catch (e) {
    return errorResponse(e);
  }
}
