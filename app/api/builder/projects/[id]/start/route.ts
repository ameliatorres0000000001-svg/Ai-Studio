import { NextResponse } from "next/server";
import { requireBuilderUser, getOwnedProject } from "@/lib/builder/access";
import { supabaseStore, toPublicProject } from "@/lib/builder/store";
import { ensureRun } from "@/lib/builder/pipeline";
import { kickRun } from "@/lib/builder/live";
import { resolveBotBuilderModel } from "@/lib/bot-builder/requirements-agent";
import { checkEntitlement } from "@/lib/entitlements";
import { errorResponse } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

/** Starts (or resumes) the build pipeline. The AI template fill counts against the daily quota. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { user, error } = await requireBuilderUser(req);
  if (error) return error;
  try {
    const { project, error: ownError } = await getOwnedProject(params.id, user!.id);
    if (ownError) return ownError;

    const model = resolveBotBuilderModel();
    if (model && !project!.requirements.filledConfig && !project!.requirements.configOverride) {
      const ent = await checkEntitlement(user!.id, model.config.id, user!.email);
      if (!ent.allowed) return NextResponse.json({ error: ent.messageEn, messageKh: ent.messageKh }, { status: 429 });
    }

    const run = await ensureRun({ store: supabaseStore }, project!.id);
    await supabaseStore.audit({ actor: `user:${user!.id}`, project_id: project!.id, action: "run.start", detail: `run ${run.id} from ${run.step}` });
    kickRun(run.id);
    const instance = await supabaseStore.getInstance(project!.id);
    return NextResponse.json({ project: toPublicProject(project!, instance, run) }, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
