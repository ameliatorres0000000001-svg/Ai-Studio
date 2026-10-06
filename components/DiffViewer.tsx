"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Workspace } from "@/lib/types";
import { Button, Spinner, EmptyState, ErrorState } from "@/components/ui";

export function DiffViewer({
  workspaceId,
  onCommitted,
}: {
  workspaceId: string;
  onCommitted?: () => void;
}) {
  const [diff, setDiff] = useState<string | null>(null);
  const [changedFiles, setChangedFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [commitMsg, setCommitMsg] = useState("");
  const [committing, setCommitting] = useState(false);
  const [rollbackTag, setRollbackTag] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadDiff() {
    setLoading(true);
    setError(null);
    try {
      const { diff, changedFiles } = await api.getDiff(workspaceId);
      setDiff(diff);
      setChangedFiles(changedFiles);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDiff();
  }, [workspaceId]);

  async function commit() {
    if (!commitMsg.trim()) return;
    setCommitting(true);
    setError(null);
    setSuccess(null);
    try {
      const { backupTag } = await api.commit(workspaceId, commitMsg);
      setRollbackTag(backupTag);
      setSuccess(`Committed and pushed. Backup tag: ${backupTag}`);
      setCommitMsg("");
      onCommitted?.();
      loadDiff();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCommitting(false);
    }
  }

  async function rollback() {
    if (!rollbackTag) return;
    setRollingBack(true);
    setError(null);
    try {
      await api.rollback(workspaceId, rollbackTag);
      setSuccess(`Rolled back to ${rollbackTag}`);
      loadDiff();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRollingBack(false);
    }
  }

  if (loading) {
    return (
      <div className="diff-viewer">
        <div className="panel-header"><h3>Git Diff</h3></div>
        <Spinner label="Loading diff..." />
      </div>
    );
  }

  return (
    <div className="diff-viewer">
      <div className="panel-header">
        <h3>Git Diff</h3>
        <Button variant="ghost" className="btn-sm" onClick={loadDiff}>
          Refresh
        </Button>
      </div>

      {error && <ErrorState message={error} />}
      {success && <div className="success-banner">{success}</div>}

      {changedFiles.length === 0 ? (
        <EmptyState
          icon="="
          title="Working tree is clean"
          description="No uncommitted changes. Use Claude to edit files, then check back here to review the diff."
        />
      ) : (
        <>
          <div className="diff-files">
            <b>Changed files ({changedFiles.length})</b>
            <ul>
              {changedFiles.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
          <pre className="diff-content">{diff}</pre>

          <div className="diff-actions">
            <input
              type="text"
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              placeholder="Commit message..."
              disabled={committing}
              onKeyDown={(e) => e.key === "Enter" && commit()}
            />
            <Button onClick={commit} disabled={committing || !commitMsg.trim()}>
              {committing ? "Pushing..." : "Commit & Push"}
            </Button>
            {rollbackTag && (
              <Button
                variant="danger"
                onClick={rollback}
                disabled={rollingBack}
              >
                {rollingBack ? "Rolling back..." : "Rollback"}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
