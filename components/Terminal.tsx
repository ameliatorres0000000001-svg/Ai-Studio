"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { CommandResult } from "@/lib/types";
import { Button, EmptyState } from "@/components/ui";

const QUICK_COMMANDS = [
  { label: "npm install", cmd: "npm install" },
  { label: "npm run build", cmd: "npm run build" },
  { label: "npm test", cmd: "npm test" },
  { label: "tsc", cmd: "npx tsc --noEmit" },
];

export function Terminal({ workspaceId }: { workspaceId: string }) {
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
      <div className="panel-header">
        <h3>Terminal</h3>
        <span className="badge badge-neutral">Workspace sandbox</span>
      </div>

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
            title="Terminal ready"
            description="Run allowlisted commands inside the workspace. Output will appear here."
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
                Exit: {entry.result.exitCode}
                {entry.result.timedOut ? " (timed out)" : ""}
              </div>
            </div>
          ))
        )}
        {running && (
          <div className="terminal-running">
            <div className="spinner" />
            Running...
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
          placeholder="Enter a command (npm, npx, node, git, tsc...)"
          disabled={running}
        />
        <Button onClick={() => run()} disabled={running || !input.trim()}>
          Run
        </Button>
      </div>
      <small className="terminal-note">
        Only allowlisted commands run inside the workspace. No shell chaining,
        sudo, rm -rf, or eval.
      </small>
    </div>
  );
}
