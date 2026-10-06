"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";

export function ClaudeChat({
  workspaceId,
  currentFile,
  fileContent,
  onApplied,
}: {
  workspaceId: string;
  currentFile?: string;
  fileContent?: string;
  onApplied?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    filesChanged: string[];
    diff: string | null;
    applied: boolean;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const { messages } = await api.getMessages(workspaceId);
        setMessages(messages);
      } catch {
        // ignore
      }
    }
    load();
  }, [workspaceId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function send(apply: boolean = false) {
    if (!input.trim() || loading) return;
    const userMsg = input;
    setInput("");
    setLoading(true);
    setError(null);
    setLastResult(null);

    setMessages((prev) => [
      ...prev,
      {
        id: "temp-" + Date.now(),
        workspace_id: workspaceId,
        role: "user",
        content: userMsg,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const result = await api.claudeChat(workspaceId, userMsg, {
        currentFile,
        fileContent,
        apply,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: "temp-a-" + Date.now(),
          workspace_id: workspaceId,
          role: "assistant",
          content: result.response,
          created_at: new Date().toISOString(),
        },
      ]);

      if (result.filesChanged.length > 0) {
        setLastResult({
          filesChanged: result.filesChanged,
          diff: result.diff,
          applied: result.applied,
        });
        if (result.applied) {
          onApplied?.();
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="claude-chat">
      <h3>AI Assistant (Claude)</h3>
      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <p className="chat-empty">
            Tell Claude what to change in this project. Try:
            <br />
            "Add a Telegram button"
            <br />
            "Explain the main file"
            <br />
            "Fix the login bug"
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.role}`}>
            <small>{m.role === "user" ? "You" : "Claude"}</small>
            <p>{m.content}</p>
          </div>
        ))}
        {loading && <p className="chat-loading">Claude is thinking...</p>}
      </div>

      {error && <p className="chat-error">{error}</p>}

      {lastResult && !lastResult.applied && (
        <div className="claude-result">
          <p>
            Claude proposes changes to {lastResult.filesChanged.length} file(s):
          </p>
          <ul>
            {lastResult.filesChanged.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <button
            className="wide"
            onClick={() => send(true)}
            disabled={loading}
          >
            Apply Changes →
          </button>
        </div>
      )}

      {lastResult?.applied && (
        <div className="claude-result applied">
          <p>
            Changes applied to {lastResult.filesChanged.length} file(s). Review
            the diff in the Diff tab, then approve or rollback.
          </p>
        </div>
      )}

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="e.g. Add a Telegram button and keep the current design..."
        disabled={loading}
      />
      <div className="chat-actions">
        <button
          className="wide"
          onClick={() => send(false)}
          disabled={loading || !input.trim()}
        >
          Analyze →
        </button>
        <button
          className="wide"
          onClick={() => send(true)}
          disabled={loading || !input.trim()}
          style={{ marginTop: "6px", background: "#1a8a5e" }}
        >
          Edit Project →
        </button>
      </div>
    </div>
  );
}
