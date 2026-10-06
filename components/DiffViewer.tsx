"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Workspace } from "@/lib/types";

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

  if (loading) return <p>Loading diff...</p>;

  return (
    <div className="diff-viewer">
      <h3>Git Diff</h3>
      {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}
      {success && <p style={{ color: "#42ddb1" }}>{success}</p>}

      {changedFiles.length === 0 ? (
        <p>No uncommitted changes. The working tree is clean.</p>
      ) : (
        <>
          <div className="diff-files">
            <b>Changed files ({changedFiles.length}):</b>
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
            />
            <button
              onClick={commit}
              disabled={committing || !commitMsg.trim()}
            >
              {committing ? "Pushing..." : "Commit & Push"}
            </button>
            {rollbackTag && (
              <button
                onClick={rollback}
                disabled={rollingBack}
                style={{ background: "#a53030" }}
              >
                {rollingBack ? "Rolling back..." : "Rollback"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
