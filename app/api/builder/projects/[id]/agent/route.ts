import { NextResponse } from "next/server";
import { requireBuilderUser, getOwnedProject } from "@/lib/builder/access";
import { runProjectAgent, containsSecret } from "@/lib/builder/agent";
import { resolveBotBuilderModel } from "@/lib/bot-builder/requirements-agent";
import { checkEntitlement } from "@/lib/entitlements";
import { logUsage } from "@/lib/usage";
import { errorResponse } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * "ប្រាប់ AI ឲ្យកែ": the owner asks the platform agent to change THEIR bot.
 * Quota-checked like any model call; usage is logged; every tool call is audited.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { user, error } = await requireBuilderUser(req);
  if (error) return error;
  try {
    const { project, error: ownError } = await getOwnedProject(params.id, user!.id);
    if (ownError) return ownError;
    const body = await req.json().catch(() => ({}));
    const instruction = typeof body.instruction === "string" ? body.instruction.trim().slice(0, 2000) : "";
    if (!instruction) return NextResponse.json({ error: "instruction is required" }, { status: 400 });
    if (containsSecret(instruction)) {
      return NextResponse.json({ error: "Do not paste tokens or keys", messageKh: "សូមកុំបិទភ្ជាប់ Token ឬកូនសោសម្ងាត់។ TeleScripts គ្រប់គ្រងវាដោយស្វ័យប្រវត្តិ។" }, { status: 400 });
    }
    const model = resolveBotBuilderModel();
    if (!model) return NextResponse.json({ error: "No model configured", setupRequired: true }, { status: 400 });
    const ent = await checkEntitlement(user!.id, model.config.id, user!.email);
    if (!ent.allowed) return NextResponse.json({ error: ent.messageEn, messageKh: ent.messageKh }, { status: 429 });

    const result = await runProjectAgent({ projectId: project!.id, actor: `user:${user!.id}`, instruction, model, signal: req.signal });
    await logUsage({ userId: user!.id, workspaceId: null, model, purpose: "code", usage: result.usage });
    return NextResponse.json({ reply: result.reply, actions: result.actions });
  } catch (e) {
    return errorResponse(e);
  }
}
