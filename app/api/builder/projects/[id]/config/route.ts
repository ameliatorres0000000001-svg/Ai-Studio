import { NextResponse } from "next/server";
import { requireBuilderUser, getOwnedProject } from "@/lib/builder/access";
import { supabaseStore, toPublicProject } from "@/lib/builder/store";
import { normalizeContent } from "@/lib/builder/template-content";
import { restartFrom, RunBusyError } from "@/lib/builder/pipeline";
import { kickRun } from "@/lib/builder/live";
import { errorResponse } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

/**
 * Owner edits from the Settings tab. The config is validated, saved as
 * requirements.configOverride, and — for a bot that is already deployed — a
 * new run rebuilds the repo and redeploys from provision_repo.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { user, error } = await requireBuilderUser(req);
  if (error) return error;
  try {
    const { project, error: ownError } = await getOwnedProject(params.id, user!.id);
    if (ownError) return ownError;
    const body = await req.json().catch(() => ({}));
    const config = normalizeContent(project!.template, body.config);
    if (!config) return NextResponse.json({ error: "Invalid configuration" }, { status: 400 });

    await supabaseStore.updateProject(project!.id, { requirements: { ...project!.requirements, configOverride: config } });
    await supabaseStore.audit({ actor: `user:${user!.id}`, project_id: project!.id, action: "config.update", detail: "owner edited bot configuration" });

    const instance = await supabaseStore.getInstance(project!.id);
    let redeploying = false;
    if (instance && (instance.status === "deployed" || instance.status === "live")) {
      try {
        const run = await restartFrom({ store: supabaseStore }, project!.id, "provision_repo");
        kickRun(run.id);
        redeploying = true;
      } catch (e) {
        if (e instanceof RunBusyError) return NextResponse.json({ error: e.message, saved: true }, { status: 409 });
        throw e;
      }
    }
    const fresh = await supabaseStore.getProject(project!.id);
    return NextResponse.json({ project: toPublicProject(fresh!, instance, await supabaseStore.latestRun(project!.id)), redeploying });
  } catch (e) {
    return errorResponse(e);
  }
}
