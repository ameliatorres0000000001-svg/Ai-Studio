import { NextResponse } from "next/server";
import { requireBuilderUser, getOwnedProject } from "@/lib/builder/access";
import { supabaseStore, toPublicProject } from "@/lib/builder/store";
import { resumeIfStale } from "@/lib/builder/live";
import { errorResponse } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { user, error } = await requireBuilderUser(req);
  if (error) return error;
  try {
    const { project, error: ownError } = await getOwnedProject(params.id, user!.id);
    if (ownError) return ownError;
    const [instance, run] = await Promise.all([supabaseStore.getInstance(project!.id), supabaseStore.latestRun(project!.id)]);
    resumeIfStale(run);
    return NextResponse.json({ project: toPublicProject(project!, instance, run) });
  } catch (e) {
    return errorResponse(e);
  }
}
