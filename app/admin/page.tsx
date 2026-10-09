"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Button, EmptyState } from "@/components/ui";

interface PendingItem {
  id: string;
  userId: string;
  userEmail: string | null;
  planId: string;
  amount: number;
  trxId: string;
  receiptUrl: string | null;
  createdAt: string;
}

interface UserInfo {
  plan: string;
  expiresAt: string | null;
  expired: boolean;
  disabled: boolean;
  today: number;
  byModel: { modelId: string; requests: number; inputTokens: number; outputTokens: number }[];
}

/** Admin-only console. Every action is logged server-side to activities. */
export default function AdminPage() {
  const { t } = useLang();
  const [gate, setGate] = useState<"loading" | "denied" | "ok">("loading");
  const [items, setItems] = useState<PendingItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [lookupId, setLookupId] = useState("");
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [planId, setPlanId] = useState("pro");
  const [expiry, setExpiry] = useState("");

  useEffect(() => {
    api
      .adminMe()
      .then(({ isAdmin }) => {
        if (!isAdmin) {
          setGate("denied");
          return;
        }
        setGate("ok");
        refresh();
      })
      .catch(() => setGate("denied"));
  }, []);

  function refresh() {
    api
      .adminPending()
      .then(({ items }) => setItems(items))
      .catch((e: any) => setError(e.message));
  }

  async function review(id: string, action: "approve" | "reject") {
    setBusy(id + action);
    setError(null);
    try {
      await api.adminReview(id, action);
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function lookup() {
    if (!lookupId.trim()) return;
    setError(null);
    setUserInfo(null);
    try {
      setUserInfo(await api.adminUser(lookupId.trim()));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function setPlan() {
    if (!lookupId.trim()) return;
    setError(null);
    try {
      await api.adminSetPlan(lookupId.trim(), planId, expiry || null);
      await lookup();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function toggleDisable(disabled: boolean) {
    if (!lookupId.trim()) return;
    setError(null);
    try {
      await api.adminDisable(lookupId.trim(), disabled);
      await lookup();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (gate === "loading") {
    return (
      <main style={{ padding: 32 }}>
        <div className="chat-loading"><div className="spinner" />{t("loading")}</div>
      </main>
    );
  }
  if (gate === "denied") {
    return (
      <main style={{ padding: 32 }}>
        <div className="chat-error">{t("adminOnly")}</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 16 }}>{t("adminPanel")}</h2>
      {error && <div className="chat-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="admin-grid">
        <div className="panel">
          <div className="panel-header">
            <h3>Pending ({items?.length ?? "…"})</h3>
            <Button variant="ghost" className="btn-sm" onClick={refresh}>{t("refresh")}</Button>
          </div>
          {!items ? (
            <p>{t("loading")}</p>
          ) : items.length === 0 ? (
            <EmptyState icon="✓" title="Empty" description="No pending payments." />
          ) : (
            <div className="admin-pending">
              {items.map((it) => (
                <div key={it.id} className="admin-card">
                  <div className="admin-kv">
                    <span>Plan</span><b>{it.planId} · ${it.amount}</b>
                    <span>User</span><b>{it.userEmail || it.userId}</b>
                    <span>TRX</span><b>{it.trxId}</b>
                    <span>Date</span><b>{new Date(it.createdAt).toLocaleString()}</b>
                  </div>
                  {it.receiptUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.receiptUrl} alt="Receipt" />
                  ) : (
                    <small>No receipt preview</small>
                  )}
                  <div className="admin-row">
                    <Button
                      className="btn-sm"
                      disabled={busy === it.id + "approve"}
                      onClick={() => review(it.id, "approve")}
                    >
                      {t("approveBtn")}
                    </Button>
                    <Button
                      variant="danger"
                      className="btn-sm"
                      disabled={busy === it.id + "reject"}
                      onClick={() => review(it.id, "reject")}
                    >
                      {t("rejectBtn")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>User</h3>
          </div>
          <div className="admin-row" style={{ marginBottom: 12 }}>
            <input
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              placeholder="user uuid"
              style={{ flex: 1 }}
            />
            <Button className="btn-sm" onClick={lookup}>{t("lookupUser")}</Button>
          </div>
          {userInfo && (
            <>
              <div className="admin-kv" style={{ marginBottom: 12 }}>
                <span>Plan</span><b>{userInfo.plan}{userInfo.expired ? " (expired)" : ""}</b>
                <span>Expires</span><b>{userInfo.expiresAt || "—"}</b>
                <span>Today</span><b>{userInfo.today} requests</b>
                <span>Status</span><b>{userInfo.disabled ? "disabled" : "active"}</b>
              </div>
              <div className="admin-row" style={{ marginBottom: 12 }}>
                <input value={planId} onChange={(e) => setPlanId(e.target.value)} placeholder="plan id" />
                <input
                  type="date"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  placeholder="expiry"
                />
                <Button className="btn-sm" variant="secondary" onClick={setPlan}>
                  Set plan
                </Button>
              </div>
              <div className="admin-row" style={{ marginBottom: 12 }}>
                <Button
                  className="btn-sm"
                  variant={userInfo.disabled ? "secondary" : "danger"}
                  onClick={() => toggleDisable(!userInfo.disabled)}
                >
                  {userInfo.disabled ? "Enable" : "Disable"}
                </Button>
              </div>
              {userInfo.byModel.length > 0 && (
                <div className="admin-kv">
                  {userInfo.byModel.map((m) => (
                    <span key={m.modelId} style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between" }}>
                      <b>{m.modelId}</b>
                      <span>{m.requests} req · {m.inputTokens} in · {m.outputTokens} out</span>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
