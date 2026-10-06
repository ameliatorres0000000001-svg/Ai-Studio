"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { Button, EmptyState } from "@/components/ui";

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
  const { t, lang } = useLang();
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
      <div className="chat-header">
        <div className="chat-header-info">
          <span className="chat-header-icon">✦</span>
          <span className="chat-header-title">{t("aiAssistant")}</span>
        </div>
        <div className="chat-header-status">
          <span className={`claude-status-dot ${loading ? "thinking" : "idle"}`} />
          <small>{loading ? t("claudeThinking") : (lang === "kh" ? "រួចរាល់" : "Ready")}</small>
        </div>
      </div>

      {currentFile && (
        <div className="chat-context-file">
          <span className="badge badge-neutral" style={{ fontFamily: "var(--font-mono)" }}>
            {currentFile}
          </span>
        </div>
      )}

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <strong>{t("startConversation")}</strong>
            {t("tryExamples")}
            <br />
            &ldquo;{t("example1")}&rdquo;
            <br />
            &ldquo;{t("example2")}&rdquo;
            <br />
            &ldquo;{t("example3")}&rdquo;
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.role}`}>
            <small>{m.role === "user" ? (lang === "kh" ? "អ្នក" : "You") : "Claude"}</small>
            <p>{m.content}</p>
          </div>
        ))}
        {loading && (
          <div className="chat-loading">
            <div className="spinner" />
            {t("claudeThinking")}
          </div>
        )}
      </div>

      {error && <div className="chat-error">{error}</div>}

      {lastResult && !lastResult.applied && (
        <div className="claude-result">
          <p>{t("proposeChanges")} {lastResult.filesChanged.length} {t("filesChanged")}:</p>
          <ul>
            {lastResult.filesChanged.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <Button onClick={() => send(true)} disabled={loading}>
            {t("applyChanges")}
          </Button>
        </div>
      )}

      {lastResult?.applied && (
        <div className="success-banner">
          {t("changesApplied")} {lastResult.filesChanged.length} {t("filesChanged")}. {t("reviewDiff")}
        </div>
      )}

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t("messagePlaceholder")}
        disabled={loading}
      />
      <div className="chat-actions">
        <Button
          variant="secondary"
          onClick={() => send(false)}
          disabled={loading || !input.trim()}
          className="btn-block"
        >
          {t("analyze")}
        </Button>
        <Button
          onClick={() => send(true)}
          disabled={loading || !input.trim()}
          className="btn-block"
        >
          {t("editProject")}
        </Button>
      </div>
    </div>
  );
}
