"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { CommandResult } from "@/lib/types";

export function Terminal({ workspaceId }: { workspaceId: string }) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<
    { cmd: string; result: CommandResult }[]
  >([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!input.trim() || running) return;
    const cmd = input.trim();
    setInput("");
    setRunning(true);
    setError(null);

    try {
      const result = await api.runCommand(workspaceId, cmd);
      setOutput((prev) => [...prev, { cmd, result }]);
    } catch (e: any) {
      setError(e.message);
      setOutput((prev) => [
        ...prev,
        {
          cmd,
          result: {
            stdout: "",
            stderr: e.message,
            exitCode: null,
            timedOut: false,
          },
        },
      ]);
    } finally {
      setRunning(false);
    }
  }

  function quickRun(command: string) {
    setInput(command);
  }

  return (
    <div className="terminal">
      <h3>Terminal</h3>
      <div className="terminal-quick">
        <button onClick={() => quickRun("npm install")}>npm install</button>
        <button onClick={() => quickRun("npm run build")}>npm run build</button>
        <button onClick={() => quickRun("npm test")}>npm test</button>
        <button onClick={() => quickRun("npx tsc --noEmit")}>tsc</button>
      </div>
      <div className="terminal-output">
        {output.length === 0 && <p className="terminal-empty">$ Output will appear here</p>}
        {output.map((entry, i) => (
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
        ))}
        {running && <p className="terminal-running">Running...</p>}
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
        <button onClick={run} disabled={running || !input.trim()}>
          Run
        </button>
      </div>
      <small className="terminal-note">
        Only allowlisted commands run inside the workspace. No shell chaining,
        sudo, rm -rf, or eval.
      </small>
    </div>
  );
}
