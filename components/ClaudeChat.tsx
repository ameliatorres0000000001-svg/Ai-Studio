"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";
import { Button, Spinner, EmptyState } from "@/components/ui";

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
        if (result.applied) onApplied?.();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="claude-chat">
      <div className="panel-header" style={{ marginBottom: 0 }}>
        <h3>AI Assistant (Claude)</h3>
        {currentFile && (
          <span className="badge badge-neutral" style={{ fontFamily: "var(--font-mono)" }}>
            {currentFile}
          </span>
        )}
      </div>

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <strong>Start a conversation with Claude</strong>
            Try:
            <br />
            &ldquo;Add a Telegram button&rdquo;
            <br />
            &ldquo;Explain the main file&rdquo;
            <br />
            &ldquo;Fix the login bug&rdquo;
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.role}`}>
            <small>{m.role === "user" ? "You" : "Claude"}</small>
            <p>{m.content}</p>
          </div>
        ))}
        {loading && (
          <div className="chat-loading">
            <div className="spinner" />
            Claude is thinking...
          </div>
        )}
      </div>

      {error && <div className="chat-error">{error}</div>}

      {lastResult && !lastResult.applied && (
        <div className="claude-result">
          <p>Claude proposes changes to {lastResult.filesChanged.length} file(s):</p>
          <ul>
            {lastResult.filesChanged.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <Button onClick={() => send(true)} disabled={loading}>
            Apply Changes
          </Button>
        </div>
      )}

      {lastResult?.applied && (
        <div className="success-banner">
          Changes applied to {lastResult.filesChanged.length} file(s). Review the
          diff in the Diff tab, then approve or rollback.
        </div>
      )}

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="e.g. Add a Telegram button and keep the current design..."
        disabled={loading}
      />
      <div className="chat-actions">
        <Button
          variant="secondary"
          onClick={() => send(false)}
          disabled={loading || !input.trim()}
          className="btn-block"
        >
          Analyze
        </Button>
        <Button
          onClick={() => send(true)}
          disabled={loading || !input.trim()}
          className="btn-block"
        >
          Edit Project
        </Button>
      </div>
    </div>
  );
}
