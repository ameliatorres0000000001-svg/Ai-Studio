"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Workspace } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { Button, Spinner, EmptyState, ErrorState } from "@/components/ui";

export function DiffViewer({
  workspaceId,
  onCommitted,
  compact,
}: {
  workspaceId: string;
  onCommitted?: () => void;
  compact?: boolean;
}) {
  const { t } = useLang();
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
      setSuccess(`${t("committed")} ${backupTag}`);
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
      setSuccess(`${t("rolledBack")} ${rollbackTag}`);
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
        <Spinner label={t("loadingDiff")} />
      </div>
    );
  }

  return (
    <div className="diff-viewer">
      {!compact && (
        <div className="panel-header">
          <h3>{t("gitDiff")}</h3>
          <Button variant="ghost" className="btn-sm" onClick={loadDiff}>
            {t("refresh")}
          </Button>
        </div>
      )}

      {error && <ErrorState message={error} />}
      {success && <div className="success-banner">{success}</div>}

      {changedFiles.length === 0 ? (
        <EmptyState
          icon="="
          title={t("workingTreeClean")}
          description={t("cleanDesc")}
        />
      ) : (
        <>
          <div className="diff-files">
            <b>{t("changedFiles")} ({changedFiles.length})</b>
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
              placeholder={t("commitMsg")}
              disabled={committing}
              onKeyDown={(e) => e.key === "Enter" && commit()}
            />
            <Button onClick={commit} disabled={committing || !commitMsg.trim()}>
              {committing ? t("pushing") : t("commitPush")}
            </Button>
            {rollbackTag && (
              <Button
                variant="danger"
                onClick={rollback}
                disabled={rollingBack}
              >
                {rollingBack ? t("rollingBack") : t("rollback")}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
