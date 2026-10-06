"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { Terminal } from "@/components/Terminal";
import { ActivityHistory } from "@/components/ActivityHistory";
import { DiffViewer } from "@/components/DiffViewer";

type BottomTab = "terminal" | "logs" | "tests" | "diff" | "deployments" | "activity";

export function BottomPanel({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose?: () => void;
}) {
  const { t, lang } = useLang();
  const [activeTab, setActiveTab] = useState<BottomTab>("terminal");
  const [terminalTabs, setTerminalTabs] = useState<string[]>(["Terminal 1"]);
  const [activeTerminal, setActiveTerminal] = useState(0);

  const tabs: { id: BottomTab; label: string; icon: string }[] = [
    { id: "terminal", label: t("terminal"), icon: "▶" },
    { id: "logs", label: t("logs"), icon: "≡" },
    { id: "tests", label: t("tests"), icon: "✓" },
    { id: "diff", label: t("gitDiff"), icon: "≡" },
    { id: "deployments", label: t("deployments"), icon: "▲" },
    { id: "activity", label: t("activityHistory"), icon: "◷" },
  ];

  function addTerminalTab() {
    const next = terminalTabs.length + 1;
    setTerminalTabs([...terminalTabs, `Terminal ${next}`]);
    setActiveTerminal(terminalTabs.length);
  }

  function closeTerminalTab(idx: number) {
    if (terminalTabs.length <= 1) return;
    const next = terminalTabs.filter((_, i) => i !== idx);
    setTerminalTabs(next);
    if (activeTerminal >= next.length) setActiveTerminal(next.length - 1);
  }

  return (
    <div className="bottom-panel">
      <div className="bottom-panel-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`bottom-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="bottom-tab-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
        <div className="bottom-panel-spacer" />
        {onClose && (
          <button className="bottom-panel-close" onClick={onClose}>
            ▼
          </button>
        )}
      </div>

      <div className="bottom-panel-content">
        {activeTab === "terminal" && (
          <div className="terminal-tabs-container">
            <div className="terminal-tab-bar">
              {terminalTabs.map((tt, i) => (
                <div
                  key={i}
                  className={`terminal-tab-chip ${activeTerminal === i ? "active" : ""}`}
                  onClick={() => setActiveTerminal(i)}
                >
                  {tt}
                  {terminalTabs.length > 1 && (
                    <button
                      className="terminal-tab-close"
                      onClick={(e) => { e.stopPropagation(); closeTerminalTab(i); }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button className="terminal-tab-add" onClick={addTerminalTab}>
                +
              </button>
            </div>
            <Terminal workspaceId={workspaceId} />
          </div>
        )}

        {activeTab === "logs" && (
          <ActivityHistory workspaceId={workspaceId} />
        )}

        {activeTab === "tests" && (
          <Terminal workspaceId={workspaceId} />
        )}

        {activeTab === "diff" && (
          <DiffViewer workspaceId={workspaceId} compact />
        )}

        {activeTab === "deployments" && (
          <div className="empty-state">
            <div className="empty-icon">▲</div>
            <h4>{lang === "kh" ? "ការបង្ហោះ" : "Deployments"}</h4>
            <p>
              {lang === "kh"
                ? "ភ្ជាប់ Vercel និង Railway នៅក្នុង Settings ដើម្បីបង្ហោះគម្រោង។"
                : "Connect Vercel and Railway in Settings to deploy your project."}
            </p>
          </div>
        )}

        {activeTab === "activity" && (
          <ActivityHistory workspaceId={workspaceId} />
        )}
      </div>
    </div>
  );
}
