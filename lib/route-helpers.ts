import { NextResponse } from "next/server";
import type { Workspace } from "./types";
import { getWorkspacePath, workspaceExists, redactSecrets } from "./workspace";

// SERVER-ONLY helpers shared by API routes.

/**
 * The on-disk location is always derived from the workspace id on the server;
 * the `local_path` column is never trusted or exposed.
 */
export function resolveLocalPath(
  workspace: Workspace
): { localPath: string; error: NextResponse | null } {
  const localPath = getWorkspacePath(workspace.id);
  if (!workspaceExists(workspace.id)) {
    return {
      localPath,
      error: NextResponse.json(
        {
          error:
            "Workspace files are not present on the server (first sync not finished, or the server storage was reset). Sync the repository again.",
          syncRequired: true,
        },
        { status: 409 }
      ),
    };
  }
  return { localPath, error: null };
}

/** JSON error response that can never leak a secret in the message. */
export function errorResponse(e: unknown, status = 500): NextResponse {
  const message = redactSecrets(e instanceof Error ? e.message : String(e));
  return NextResponse.json({ error: message }, { status });
}
