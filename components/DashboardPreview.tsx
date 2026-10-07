"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Local, demo-only dashboard preview.
 *
 * Rendered in two places:
 *  - the real app's "Preview" tab (`embedded`) – the app's own sidebar/header are reused
 *  - the standalone /dashboard-preview route – brings its own sidebar/header
 *
 * Nothing in here calls an API. "Connect" only flips local React state; the values
 * typed into the demo form are never stored or transmitted.
 */

const integrations = [
  { id: "github", name: "GitHub", description: "Connect your GitHub repository", icon: "/icon/image.png", fallback: "GH", fields: ["Repository URL"] },
  { id: "claude", name: "Claude Code", description: "Connect your Claude Code workspace", icon: "/icon/claude.png", fallback: "CC", fields: ["Workspace name"] },
  { id: "supabase", name: "Supabase", description: "Connect your Supabase project", icon: "/icon/supabase.png", fallback: "SB", fields: ["Project URL"] },
  { id: "telegram", name: "Telegram", description: "Connect your Telegram bot", icon: "/icon/telegram.png", fallback: "TG", fields: ["Bot username"] },
] as const;

type IntegrationId = (typeof integrations)[number]["id"];
type DemoConnection = Record<IntegrationId, boolean>;
type PreviewTab = "Dashboard" | "Code" | "Preview" | "Settings";

const initialConnections: DemoConnection = { github: false, claude: false, supabase: false, telegram: false };
const PREVIEW_TABS: PreviewTab[] = ["Dashboard", "Code", "Preview", "Settings"];

const SAMPLE_FILES = ["app/page.tsx", "components/DashboardPreview.tsx", "lib/api.ts", "README.md"];
const SAMPLE_CODE = `export default function Home() {
  const [tab, setTab] = useState<Tab>("Dashboard");
  // Demo snippet – nothing here is read from your repository.
  return <Workspace tab={tab} onChange={setTab} />;
}`;

function ServiceIcon({ icon, fallback }: { icon: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="preview-service-icon">
      {failed ? <span>{fallback}</span> : <img src={icon} alt="" onError={() => setFailed(true)} />}
    </div>
  );
}

export default function DashboardPreview({ embedded = false }: { embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState<PreviewTab>("Preview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationId | null>(null);
  const [connections, setConnections] = useState<DemoConnection>(initialConnections);
  const [formValue, setFormValue] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [refreshKey, setRefreshKey] = useState(0);
  const toastTimer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = integrations.find((item) => item.id === selectedIntegration);
  const connectedCount = Object.values(connections).filter(Boolean).length;

  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }, []);

  function showToast(message: string, ms = 2200) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  }

  function openIntegration(id: IntegrationId) {
    setSelectedIntegration(id);
    setFormValue("");
    setMobileNavOpen(false);
  }

  function connectDemo() {
    if (!selectedIntegration) return;
    // Local state only. formValue is intentionally discarded.
    setConnections((current) => ({ ...current, [selectedIntegration]: true }));
    setSelectedIntegration(null);
    setFormValue("");
    showToast("Connected in local preview mode", 2600);
  }

  function disconnectDemo(id: IntegrationId) {
    setConnections((current) => ({ ...current, [id]: false }));
    showToast("Disconnected (demo)");
  }

  function refreshPreview() {
    setRefreshKey((k) => k + 1);
    showToast("Preview refreshed", 1800);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      (rootRef.current ?? document.documentElement).requestFullscreen?.();
    }
  }

  const tabTitle = activeTab === "Preview" ? "Dashboard preview" : `${activeTab} preview`;

  const body = (
    <div className="preview-main">
      {!embedded && (
        <div className="preview-header">
          <div className="preview-header-left">
            <button className="preview-menu-button" type="button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}>☰</button>
            <div>
              <span className="preview-eyebrow">Workspace</span>
              <h1>AI Developer Workspace</h1>
            </div>
          </div>
          <div className="preview-header-meta">
            <span className="preview-repo-dot" />
            <span>BarameyDabber</span>
            <span className="preview-meta-muted">· main</span>
          </div>
        </div>
      )}

      <div className="preview-tabs" role="tablist" aria-label="Preview sections">
        {PREVIEW_TABS.map((tab) => (
          <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      <div className="preview-content">
        <div className="preview-toolbar">
          <div className="preview-toolbar-title">
            <span className="preview-live-dot" />
            <strong>{tabTitle}</strong>
            <span className="preview-demo-label">UI DEMO</span>
          </div>
          <div className="preview-toolbar-actions">
            <button type="button" onClick={refreshPreview}>↻ <span>Refresh</span></button>
            <button type="button" className={viewport === "desktop" ? "active" : ""} onClick={() => setViewport("desktop")}>▣ <span>Desktop</span></button>
            <button type="button" className={viewport === "mobile" ? "active" : ""} onClick={() => setViewport("mobile")}>▯ <span>Mobile</span></button>
            <button type="button" onClick={() => window.open("/dashboard-preview", "_blank")}>↗ <span>Open in new tab</span></button>
            <button type="button" onClick={toggleFullscreen}>⛶ <span>Fullscreen</span></button>
          </div>
        </div>

        <div key={refreshKey} className={`preview-frame ${viewport === "mobile" ? "mobile" : ""}`}>
          <div className="preview-stepbar">
            {["GitHub", "Repository", "Claude Code", "Configure", "Diff", "Review", "Deploy"].map((step, index) => (
              <div className={`preview-step ${index < 3 ? "complete" : index === 3 ? "current" : ""}`} key={step}>
                <span>{index < 3 ? "✓" : index + 1}</span>
                <small>{step}</small>
                {index < 6 && <i>→</i>}
              </div>
            ))}
          </div>

          {activeTab === "Preview" && (
            <>
              <div className="preview-hero-card">
                <div>
                  <span className="preview-eyebrow">AI DEVELOPER WORKSPACE</span>
                  <h2>Build, connect and manage your developer workspace</h2>
                  <p>Connect your GitHub repository, Claude Code, Supabase and Telegram from one workspace.</p>
                  <button className="preview-primary-button" type="button" onClick={() => openIntegration("github")}>Open Workspace <span>→</span></button>
                </div>
                <div className="preview-hero-art" aria-hidden="true"><span>⌘</span><i>+</i><b>◈</b></div>
              </div>

              <div className="preview-section">
                <div className="preview-section-heading">
                  <div>
                    <span className="preview-eyebrow">WORKSPACE SERVICES</span>
                    <h2>Integrations</h2>
                  </div>
                  <span className="preview-section-count">{connectedCount}/4 connected</span>
                </div>
                <div className="preview-integration-list">
                  {integrations.map((integration) => (
                    <div className="preview-integration-row" key={integration.id}>
                      <ServiceIcon icon={integration.icon} fallback={integration.fallback} />
                      <div className="preview-integration-copy">
                        <strong>{integration.name}</strong>
                        <span>{integration.description}</span>
                      </div>
                      {connections[integration.id] ? (
                        <span className="preview-connected"><i /> Connected</span>
                      ) : (
                        <button className="preview-connect-button" type="button" onClick={() => openIntegration(integration.id)}>Connect <span>→</span></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="preview-bottom-grid">
                <div className="preview-mini-card">
                  <span className="preview-eyebrow">CURRENT PROJECT</span>
                  <strong>BarameyDabber</strong>
                  <span>main branch · Ready for work</span>
                </div>
                <div className="preview-mini-card">
                  <span className="preview-eyebrow">NEXT STEP</span>
                  <strong>{connections.github ? "Choose a repository" : "Review repository setup"}</strong>
                  <span>{connections.github ? "GitHub connected (demo)" : "Connect GitHub to begin"}</span>
                </div>
              </div>
            </>
          )}

          {activeTab === "Dashboard" && (
            <div className="preview-section" style={{ marginTop: 0 }}>
              <div className="preview-section-heading">
                <div>
                  <span className="preview-eyebrow">OVERVIEW</span>
                  <h2>Dashboard</h2>
                </div>
                <span className="preview-section-count">{connectedCount}/4 connected</span>
              </div>
              <div className="preview-integration-list">
                {integrations.map((integration) => (
                  <div className="preview-integration-row" key={integration.id}>
                    <ServiceIcon icon={integration.icon} fallback={integration.fallback} />
                    <div className="preview-integration-copy">
                      <strong>{integration.name}</strong>
                      <span>{connections[integration.id] ? "Connected in demo mode" : integration.description}</span>
                    </div>
                    {connections[integration.id] ? (
                      <span className="preview-connected"><i /> Connected</span>
                    ) : (
                      <button className="preview-connect-button" type="button" onClick={() => openIntegration(integration.id)}>Connect <span>→</span></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "Code" && (
            <div className="preview-section" style={{ marginTop: 0 }}>
              <div className="preview-section-heading">
                <div>
                  <span className="preview-eyebrow">SAMPLE FILES</span>
                  <h2>Code</h2>
                </div>
                <span className="preview-section-count">demo snippet</span>
              </div>
              <div className="preview-integration-list">
                {SAMPLE_FILES.map((file) => (
                  <div className="preview-integration-row" key={file} style={{ minHeight: 44 }}>
                    <span className="preview-nav-icon">◇</span>
                    <div className="preview-integration-copy"><strong>{file}</strong></div>
                  </div>
                ))}
              </div>
              <pre className="preview-code-block">{SAMPLE_CODE}</pre>
            </div>
          )}

          {activeTab === "Settings" && (
            <div className="preview-section" style={{ marginTop: 0 }}>
              <div className="preview-section-heading">
                <div>
                  <span className="preview-eyebrow">DEMO CONNECTIONS</span>
                  <h2>Settings</h2>
                </div>
                <span className="preview-section-count">local only</span>
              </div>
              <div className="preview-integration-list">
                {integrations.map((integration) => (
                  <div className="preview-integration-row" key={integration.id}>
                    <ServiceIcon icon={integration.icon} fallback={integration.fallback} />
                    <div className="preview-integration-copy">
                      <strong>{integration.name}</strong>
                      <span>{connections[integration.id] ? "Connected (demo)" : "Not connected"}</span>
                    </div>
                    {connections[integration.id] ? (
                      <button className="preview-connect-button" type="button" onClick={() => disconnectDemo(integration.id)}>Disconnect</button>
                    ) : (
                      <button className="preview-connect-button" type="button" onClick={() => openIntegration(integration.id)}>Connect <span>→</span></button>
                    )}
                  </div>
                ))}
              </div>
              <p className="preview-note">Demo state lives in this component only. Real connections are configured in the app's Settings tab.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const overlays = (
    <>
      {selected && (
        <div className="preview-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedIntegration(null); }}>
          <div className="preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-modal-title">
            <div className="preview-modal-header">
              <ServiceIcon icon={selected.icon} fallback={selected.fallback} />
              <button type="button" aria-label="Close dialog" onClick={() => setSelectedIntegration(null)}>×</button>
            </div>
            <span className="preview-eyebrow">DEMO CONNECTION</span>
            <h2 id="preview-modal-title">{selected.name}</h2>
            <p>Connect your {selected.name} workspace</p>
            <label>
              {selected.fields[0]}
              <input value={formValue} onChange={(event) => setFormValue(event.target.value)} placeholder={selected.fields[0]} autoFocus autoComplete="off" />
            </label>
            <div className="preview-modal-actions">
              <button type="button" className="preview-cancel-button" onClick={() => setSelectedIntegration(null)}>Cancel</button>
              <button type="button" className="preview-primary-button" onClick={connectDemo}>Connect</button>
            </div>
            <small>Demo only. No real credentials or connections are used.</small>
          </div>
        </div>
      )}
      {toast && <div className="preview-toast">✓ {toast}</div>}
    </>
  );

  if (embedded) {
    return (
      <div ref={rootRef} className="dashboard-preview-embedded">
        {body}
        {overlays}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="dashboard-preview-page">
      <div className={`preview-sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="preview-brand">
          <div className="preview-brand-mark">✦</div>
          <div>
            <strong>Claude Code</strong>
            <span>Developer workspace</span>
          </div>
        </div>
        <nav className="preview-sidebar-nav" aria-label="Preview navigation">
          {["Dashboard", "Projects", "Integrations", "Sessions", "Settings"].map((item) => (
            <button key={item} className={item === "Dashboard" ? "active" : ""} type="button">
              <span className="preview-nav-icon">{item === "Dashboard" ? "⌂" : item === "Projects" ? "◇" : item === "Integrations" ? "◌" : item === "Sessions" ? "◷" : "⚙"}</span>
              {item}
            </button>
          ))}
        </nav>
        <div className="preview-sidebar-note">
          <span>Preview workspace</span>
          <small>Local UI demo only</small>
        </div>
        <div className="preview-profile">
          <div className="preview-avatar">H</div>
          <div>
            <strong>heng</strong>
            <span>Personal workspace</span>
          </div>
          <button type="button" aria-label="Profile settings">⚙</button>
        </div>
      </div>
      {mobileNavOpen && <button className="preview-sidebar-overlay" type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      {body}
      {overlays}
    </div>
  );
}
