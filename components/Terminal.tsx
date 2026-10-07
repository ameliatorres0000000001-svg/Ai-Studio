"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { CommandResult } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { Button, EmptyState } from "@/components/ui";

const QUICK_COMMANDS = [
  { label: "npm install", cmd: "npm install" },
  { label: "npm run build", cmd: "npm run build" },
  { label: "npm test", cmd: "npm test" },
  { label: "tsc", cmd: "npx tsc --noEmit" },
];

export function Terminal({ workspaceId }: { workspaceId: string }) {
  const { t } = useLang();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<
    { cmd: string; result: CommandResult }[]
  >([]);
  const [running, setRunning] = useState(false);

  async function run(cmdArg?: string) {
    const cmd = (cmdArg || input).trim();
    if (!cmd || running) return;
    if (!cmdArg) setInput("");
    setRunning(true);

    try {
      const result = await api.runCommand(workspaceId, cmd);
      setOutput((prev) => [...prev, { cmd, result }]);
    } catch (e: any) {
      setOutput((prev) => [
        ...prev,
        {
          cmd,
          result: { stdout: "", stderr: e.message, exitCode: null, timedOut: false },
        },
      ]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="terminal">
      <div className="terminal-quick">
        {QUICK_COMMANDS.map((q) => (
          <button key={q.cmd} onClick={() => run(q.cmd)} disabled={running}>
            {q.label}
          </button>
        ))}
      </div>

      <div className="terminal-output">
        {output.length === 0 ? (
          <EmptyState
            icon="$"
            title={t("terminalReady")}
            description={t("terminalDesc")}
          />
        ) : (
          output.map((entry, i) => (
            <div key={i} className="terminal-entry">
              <div className="terminal-cmd">$ {entry.cmd}</div>
              {entry.result.stdout && (
                <pre className="terminal-stdout">{entry.result.stdout}</pre>
              )}
              {entry.result.stderr && (
                <pre className="terminal-stderr">{entry.result.stderr}</pre>
              )}
              <div className="terminal-exit">
                {t("exit")}: {entry.result.exitCode}
                {entry.result.timedOut ? " (timed out)" : ""}
              </div>
            </div>
          ))
        )}
        {running && (
          <div className="terminal-running">
            <div className="spinner" />
            {t("running")}
          </div>
        )}
      </div>

      <div className="terminal-input">
        <span>$</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="npm, npx, node, git, tsc..."
          disabled={running}
        />
        <Button onClick={() => run()} disabled={running || !input.trim()}>
          {t("run")}
        </Button>
      </div>
      <small className="terminal-note">{t("onlyAllowlisted")}</small>
    </div>
  );
}
