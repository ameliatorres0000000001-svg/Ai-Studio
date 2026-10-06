import { NextResponse } from "next/server";
import { getActivities } from "@/lib/activities";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId") || undefined;

  try {
    const activities = await getActivities(workspaceId, 100);
    return NextResponse.json({ activities });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
