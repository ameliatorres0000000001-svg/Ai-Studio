"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { ChatMessage, ChatEffort, ChatPurpose, ModelOption } from "@/lib/types";
import { useLang, type TKey } from "@/lib/i18n";
import { Button, EmptyState } from "@/components/ui";

const EFFORT_OPTIONS: { value: ChatEffort; key: TKey }[] = [
  { value: "low", key: "effortLow" },
  { value: "medium", key: "effortMedium" },
  { value: "high", key: "effortHigh" },
];
const TIER_KEY: Record<ModelOption["tier"], TKey> = {
  free: "tierFree",
  pro: "tierPro",
  premium: "tierPremium",
};

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
    proposedFiles: { path: string; content: string }[];
    diff: string | null;
    applied: boolean;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [purpose, setPurpose] = useState<ChatPurpose>("code");
  const [selected, setSelected] = useState<Partial<Record<ChatPurpose, string>>>({});
  const [effort, setEffort] = useState<ChatEffort>("medium");
  const [attachFile, setAttachFile] = useState(false);

  useEffect(() => {
    api
      .getModels()
      .then(({ models }) => {
        setModels(models);
        const first = (p: ChatPurpose) => models.find((m) => m.purpose === p)?.id;
        setSelected({ code: first("code"), research: first("research") });
        setPurpose(first("code") ? "code" : "research");
      })
      .catch(() => setModels([]));
  }, []);

  const modelId = selected[purpose];
  const currentModel = models?.find((m) => m.id === modelId);
  const canAttach = purpose === "research" && !!currentFile && fileContent !== undefined;

  function chooseModel(id: string) {
    const m = models?.find((x) => x.id === id);
    if (!m) return;
    setPurpose(m.purpose);
    setSelected((prev) => ({ ...prev, [m.purpose]: id }));
  }

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

  async function applyProposed() {
    if (!lastResult || lastResult.applied || loading) return;
    setLoading(true);
    setError(null);
    try {
      // Writes exactly what was reviewed; does not call Claude again.
      await api.applyChanges(workspaceId, lastResult.proposedFiles);
      setLastResult({ ...lastResult, applied: true });
      onApplied?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function send(apply: boolean = false) {
    if (!input.trim() || loading || !modelId) return;
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
      const result =
        purpose === "research"
          ? await api.claudeChat(workspaceId, userMsg, {
              modelId,
              purpose,
              effort: currentModel?.effortSupport ? effort : undefined,
              attachments:
                attachFile && canAttach
                  ? [{ path: currentFile!, content: fileContent! }]
                  : undefined,
            })
          : await api.claudeChat(workspaceId, userMsg, {
              modelId,
              purpose,
              effort: currentModel?.effortSupport ? effort : undefined,
              currentFile,
              fileContent,
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
        let applied = false;
        if (apply) {
          // "Edit project": write the files Claude just proposed (no second Claude call).
          await api.applyChanges(workspaceId, result.proposedFiles);
          applied = true;
          onApplied?.();
        }
        setLastResult({
          filesChanged: result.filesChanged,
          proposedFiles: result.proposedFiles,
          diff: result.diff,
          applied,
        });
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

      <div className="chat-controls">
        <div className="mode-toggle" role="group" aria-label={t("modelLabel")}>
          {(["code", "research"] as ChatPurpose[]).map((p) => (
            <button
              key={p}
              type="button"
              className={purpose === p ? "active" : ""}
              aria-pressed={purpose === p}
              disabled={loading || !selected[p]}
              onClick={() => setPurpose(p)}
            >
              {t(p === "code" ? "modeCode" : "modeResearch")}
            </button>
          ))}
        </div>
        <label className="chat-select">
          <span>{t("modelLabel")}</span>
          <select
            value={modelId ?? ""}
            onChange={(e) => chooseModel(e.target.value)}
            disabled={loading || !models?.length}
          >
            {(["code", "research"] as ChatPurpose[]).map((p) => {
              const group = (models ?? []).filter((m) => m.purpose === p);
              if (group.length === 0) return null;
              return (
                <optgroup key={p} label={t(p === "code" ? "modeCode" : "modeResearch")}>
                  {group.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} · {t(TIER_KEY[m.tier])}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>
        <label className="chat-select">
          <span>{t("effortLabel")}</span>
          <select
            value={effort}
            onChange={(e) => setEffort(e.target.value as ChatEffort)}
            disabled={loading || !currentModel?.effortSupport}
          >
            {EFFORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.key)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {models && models.length === 0 && <div className="chat-error">{t("noModels")}</div>}

      {purpose === "code" && currentFile && (
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
          <Button onClick={applyProposed} disabled={loading}>
            {t("applyChanges")}
          </Button>
        </div>
      )}

      {lastResult?.applied && (
        <div className="success-banner">
          {t("changesApplied")} {lastResult.filesChanged.length} {t("filesChanged")}. {t("reviewDiff")}
        </div>
      )}

      {canAttach && (
        <label className="chat-attach">
          <input
            type="checkbox"
            checked={attachFile}
            onChange={(e) => setAttachFile(e.target.checked)}
            disabled={loading}
          />
          <span>
            {t("attachCurrentFile")}: <code>{currentFile}</code>
          </span>
        </label>
      )}

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t(purpose === "research" ? "researchPlaceholder" : "messagePlaceholder")}
        disabled={loading}
      />
      <div className="chat-actions">
        {purpose === "research" ? (
          <Button
            onClick={() => send(false)}
            disabled={loading || !modelId || !input.trim()}
            className="btn-block"
          >
            {t("sendMessage")}
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={() => send(false)}
              disabled={loading || !modelId || !input.trim()}
              className="btn-block"
            >
              {t("analyze")}
            </Button>
            <Button
              onClick={() => send(true)}
              disabled={loading || !modelId || !input.trim()}
              className="btn-block"
            >
              {t("editProject")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
