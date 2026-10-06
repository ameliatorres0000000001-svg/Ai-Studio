import { NextResponse } from "next/server";
import { listRepositories, isGitHubConfigured } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isGitHubConfigured()) {
    return NextResponse.json(
      {
        error: "GitHub is not configured",
        setupRequired: true,
        envVars: ["GITHUB_ACCESS_TOKEN"],
      },
      { status: 400 }
    );
  }

  try {
    const repos = await listRepositories();
    return NextResponse.json({ repos });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
