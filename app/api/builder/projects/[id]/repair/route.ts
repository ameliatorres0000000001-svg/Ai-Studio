import { NextResponse } from "next/server";
import { requireBuilderUser, getOwnedProject } from "@/lib/builder/access";
import { supabaseStore } from "@/lib/builder/store";
import { prepareRepair } from "@/lib/builder/pipeline";
import { kickRun } from "@/lib/builder/live";
import { errorResponse } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

/** "ឲ្យ AI ជួសជុល": resumes the latest failed run from its failed step (fresh retry budget). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { user, error } = await requireBuilderUser(req);
  if (error) return error;
  try {
    const { project, error: ownError } = await getOwnedProject(params.id, user!.id);
    if (ownError) return ownError;
    const run = await prepareRepair({ store: supabaseStore }, project!.id);
    if (!run) return NextResponse.json({ error: "Nothing to repair" }, { status: 409 });
    await supabaseStore.audit({ actor: `user:${user!.id}`, project_id: project!.id, action: "run.repair", detail: `resume ${run.id} at ${run.step}` });
    kickRun(run.id);
    return NextResponse.json({ run: { id: run.id, status: run.status, step: run.step } }, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
