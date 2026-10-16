import { requireBuilderUser, getOwnedProject } from "@/lib/builder/access";
import { supabaseStore, toPublicProject } from "@/lib/builder/store";
import { resumeIfStale } from "@/lib/builder/live";
import { redactSecrets } from "@/lib/redact";
import type { RunRow } from "@/lib/builder/types";

export const dynamic = "force-dynamic";

const POLL_MS = 1000;
const MAX_STREAM_MS = 15 * 60_000;

/**
 * Server-Sent Events from builder_events for the project's latest run.
 * Bearer-authenticated, so the browser reads it with fetch() + a stream reader
 * (EventSource cannot send headers). Events:
 *   event: progress  data: { id, runId, step, status, message, createdAt }
 *   event: state     data: <public project>   (on every run status change)
 * Follows a newer run if one starts (repair/config edit). Ends when the run is
 * done/failed, the client disconnects, or after 15 minutes.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { user, error } = await requireBuilderUser(req);
  if (error) return error;
  const { project, error: ownError } = await getOwnedProject(params.id, user!.id);
  if (ownError) return ownError;
  const projectId = project!.id;
  const afterParam = Number(new URL(req.url).searchParams.get("after") || 0);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${redactSecrets(JSON.stringify(data))}\n\n`));
      };
      const started = Date.now();
      let runId: string | null = null;
      let lastId = Number.isFinite(afterParam) ? afterParam : 0;
      let lastState = "";
      let closed = false;
      req.signal.addEventListener("abort", () => { closed = true; });

      try {
        while (!closed && Date.now() - started < MAX_STREAM_MS) {
          const run: RunRow | null = await supabaseStore.latestRun(projectId);
          if (run && run.id !== runId) {
            // First run: honour ?after= (client reconnect). A newer run: start from its beginning.
            if (runId !== null) lastId = 0;
            runId = run.id;
          }
          resumeIfStale(run);
          if (runId) {
            for (const e of await supabaseStore.listEvents(runId, lastId)) {
              lastId = e.id;
              send("progress", { id: e.id, runId, step: e.step, status: e.status, message: e.message, createdAt: e.created_at });
            }
          }
          const stateKey = run ? `${run.id}:${run.status}:${run.step}` : "none";
          if (stateKey !== lastState) {
            lastState = stateKey;
            const [p, instance] = await Promise.all([supabaseStore.getProject(projectId), supabaseStore.getInstance(projectId)]);
            if (p) send("state", toPublicProject(p, instance, run));
          }
          if (run && (run.status === "done" || run.status === "failed")) break;
          controller.enqueue(encoder.encode(": ping\n\n"));
          await new Promise((r) => setTimeout(r, POLL_MS));
        }
      } catch (e) {
        send("error", { message: redactSecrets(e instanceof Error ? e.message : "stream failed") });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
