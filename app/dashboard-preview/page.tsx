"use client";

import { useState } from "react";

const integrations = [
  {
    id: "github",
    name: "GitHub",
    description: "Connect your GitHub repository",
    icon: "/icon/image.png",
    fallback: "GH",
    fields: ["Repository URL"],
  },
  {
    id: "claude",
    name: "Claude Code",
    description: "Connect your Claude Code workspace",
    icon: "/icon/claude.png",
    fallback: "CC",
    fields: ["Workspace name"],
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "Connect your Supabase project",
    icon: "/icon/supabase.png",
    fallback: "SB",
    fields: ["Project URL"],
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Connect your Telegram bot",
    icon: "/icon/telegram.png",
    fallback: "TG",
    fields: ["Bot username"],
  },
] as const;

type IntegrationId = (typeof integrations)[number]["id"];

type DemoConnection = Record<IntegrationId, boolean>;

const initialConnections: DemoConnection = {
  github: false,
  claude: false,
  supabase: false,
  telegram: false,
};

export default function DashboardPreview() {
  const [activeTab, setActiveTab] = useState("Preview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationId | null>(null);
  const [connections, setConnections] = useState<DemoConnection>(initialConnections);
  const [formValue, setFormValue] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");

  const selected = integrations.find((item) => item.id === selectedIntegration);

  function openIntegration(id: IntegrationId) {
    setSelectedIntegration(id);
    setFormValue("");
    setMobileNavOpen(false);
  }

  function connectDemo() {
    if (!selectedIntegration) return;
    setConnections((current) => ({ ...current, [selectedIntegration]: true }));
    setSelectedIntegration(null);
    setFormValue("");
    setToast("Connected in local preview mode");
    window.setTimeout(() => setToast(null), 2600);
  }

  function refreshPreview() {
    setToast("Preview refreshed");
    window.setTimeout(() => setToast(null), 1800);
  }

  return (
    <main className="dashboard-preview-page">
      <aside className={`preview-sidebar ${mobileNavOpen ? "open" : ""}`}>
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
      </aside>

      {mobileNavOpen && <button className="preview-sidebar-overlay" type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <section className="preview-main">
        <header className="preview-header">
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
        </header>

        <div className="preview-tabs" role="tablist" aria-label="Workspace sections">
          {["Dashboard", "Code", "Preview", "Settings"].map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="preview-content">
          <div className="preview-toolbar">
            <div className="preview-toolbar-title">
              <span className="preview-live-dot" />
              <strong>{activeTab === "Preview" ? "Dashboard preview" : `${activeTab} preview`}</strong>
              <span className="preview-demo-label">UI DEMO</span>
            </div>
            <div className="preview-toolbar-actions">
              <button type="button" onClick={refreshPreview}>↻ <span>Refresh</span></button>
              <button type="button" className={viewport === "desktop" ? "active" : ""} onClick={() => setViewport("desktop")}>▣ <span>Desktop</span></button>
              <button type="button" className={viewport === "mobile" ? "active" : ""} onClick={() => setViewport("mobile")}>▯ <span>Mobile</span></button>
              <button type="button" onClick={() => window.open("/dashboard-preview", "_blank")}>↗ <span>Open in new tab</span></button>
              <button type="button" onClick={() => document.documentElement.requestFullscreen?.()}>⛶ <span>Fullscreen</span></button>
            </div>
          </div>

          <div className={`preview-frame ${viewport === "mobile" ? "mobile" : ""}`}>
          <div className="preview-stepbar">
            {["GitHub", "Repository", "Claude Code", "Configure", "Diff", "Review", "Deploy"].map((step, index) => (
              <div className={`preview-step ${index < 3 ? "complete" : index === 3 ? "current" : ""}`} key={step}>
                <span>{index < 3 ? "✓" : index + 1}</span>
                <small>{step}</small>
                {index < 6 && <i>→</i>}
              </div>
            ))}
          </div>

          {activeTab === "Preview" ? (
            <>
              <section className="preview-hero-card">
                <div>
                  <span className="preview-eyebrow">AI DEVELOPER WORKSPACE</span>
                  <h2>Build, connect and manage your developer workspace</h2>
                  <p>Connect your GitHub repository, Claude Code, Supabase and Telegram from one workspace.</p>
                  <button className="preview-primary-button" type="button" onClick={() => openIntegration("github")}>Open Workspace <span>→</span></button>
                </div>
                <div className="preview-hero-art" aria-hidden="true"><span>⌘</span><i>+</i><b>◈</b></div>
              </section>

              <section className="preview-section">
                <div className="preview-section-heading">
                  <div>
                    <span className="preview-eyebrow">WORKSPACE SERVICES</span>
                    <h2>Integrations</h2>
                  </div>
                  <span className="preview-section-count">{Object.values(connections).filter(Boolean).length}/4 connected</span>
                </div>
                <div className="preview-integration-list">
                  {integrations.map((integration) => (
                    <div className="preview-integration-row" key={integration.id}>
                      <div className="preview-service-icon">
                        <img src={integration.icon} alt="" onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.nextElementSibling?.removeAttribute("hidden"); }} />
                        <span hidden>{integration.fallback}</span>
                      </div>
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
              </section>

              <section className="preview-bottom-grid">
                <div className="preview-mini-card">
                  <span className="preview-eyebrow">CURRENT PROJECT</span>
                  <strong>BarameyDabber</strong>
                  <span>main branch · Ready for work</span>
                </div>
                <div className="preview-mini-card">
                  <span className="preview-eyebrow">NEXT STEP</span>
                  <strong>Review repository setup</strong>
                  <span>Connect GitHub to begin</span>
                </div>
              </section>
            </>
          ) : (
            <div className="preview-empty-state">
              <span>{activeTab === "Code" ? "⌘" : activeTab === "Settings" ? "⚙" : "◇"}</span>
              <h2>{activeTab} is represented in the existing workspace</h2>
              <p>This route is a visual-only dashboard redesign preview. The existing application remains unchanged.</p>
              <button type="button" onClick={() => setActiveTab("Preview")}>Back to Preview</button>
            </div>
          )}
          </div>
        </div>
      </section>

      {selected && (
        <div className="preview-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedIntegration(null); }}>
          <div className="preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-modal-title">
            <div className="preview-modal-header">
              <div className="preview-service-icon"><img src={selected.icon} alt="" /><span hidden>{selected.fallback}</span></div>
              <button type="button" aria-label="Close dialog" onClick={() => setSelectedIntegration(null)}>×</button>
            </div>
            <span className="preview-eyebrow">DEMO CONNECTION</span>
            <h2 id="preview-modal-title">{selected.name}</h2>
            <p>Connect your {selected.name} workspace</p>
            <label>
              {selected.fields[0]}
              <input value={formValue} onChange={(event) => setFormValue(event.target.value)} placeholder={selected.fields[0]} autoFocus />
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
    </main>
  );
}
