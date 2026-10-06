"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Activity } from "@/lib/types";
import { Spinner, EmptyState } from "@/components/ui";

const STATUS_COLORS: Record<string, string> = {
  success: "var(--success)",
  error: "var(--error)",
  warning: "var(--warning)",
  info: "var(--text-3)",
};

export function ActivityHistory({
  workspaceId,
}: {
  workspaceId?: string;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { activities } = await api.getActivities(workspaceId);
        setActivities(activities);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Activity History</h3>
        <span className="badge badge-info">Live</span>
      </div>
      {loading ? (
        <Spinner label="Loading activity..." />
      ) : activities.length === 0 ? (
        <EmptyState
          icon="◷"
          title="No activity yet"
          description="Actions like cloning, editing, running commands, and committing will be logged here."
        />
      ) : (
        <div className="activity-list">
          {activities.map((a) => (
            <div key={a.id} className="activity-row">
              <span
                className="activity-dot"
                style={{ color: STATUS_COLORS[a.status] || "var(--text-3)" }}
              >
                ●
              </span>
              <div className="activity-content">
                <b>{a.title}</b>
                {a.detail && <small>{a.detail}</small>}
                <small>{new Date(a.created_at).toLocaleString()}</small>
              </div>
              <span className="activity-type">{a.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
