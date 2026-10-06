"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Activity } from "@/lib/types";

export function ActivityHistory({
  workspaceId,
}: {
  workspaceId?: string;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
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

  const statusColor: Record<string, string> = {
    success: "#42ddb1",
    error: "#ff6b6b",
    warning: "#f5a623",
    info: "#718aa3",
  };

  return (
    <div className="panel">
      <h3>Activity History</h3>
      {loading ? (
        <p>Loading...</p>
      ) : activities.length === 0 ? (
        <p>No activity yet. Actions will be logged here.</p>
      ) : (
        <div className="activity-list">
          {activities.map((a) => (
            <div key={a.id} className="activity-row">
              <span
                className="activity-dot"
                style={{ color: statusColor[a.status] || "#718aa3" }}
              >
                ●
              </span>
              <div className="activity-content">
                <b>{a.title}</b>
                {a.detail && <small>{a.detail}</small>}
                <small>{new Date(a.created_at).toLocaleString()}</small>
              </div>
              <em>{a.type}</em>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
