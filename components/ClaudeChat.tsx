"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type {
  ChatMessage,
  ChatEffort,
  ChatPurpose,
  ModelOption,
  TokenUsage,
  ChatModelInfo,
} from "@/lib/types";
import { useLang, type TKey } from "@/lib/i18n";
import { Button } from "@/components/ui";
import { ModelIcon } from "@/components/ModelIcon";

type DisplayMsg = ChatMessage & { model?: ChatModelInfo; usage?: TokenUsage };

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
const RANK: Record<string, number> = { free: 0, pro: 1, premium: 2 };

const LS = {
  code: "ccs-chat-model-code",
  research: "ccs-chat-model-research",
  effort: "ccs-chat-effort",
};

function loadLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveLS(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: last choice is simply not remembered */
  }
}

const supports = (m: ModelOption, p: ChatPurpose) => m.purpose.includes(p);

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
  const [messages, setMessages] = useState<DisplayMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<{ kh: string; en: string } | null>(null);
  const [lastResult, setLastResult] = useState<{
    filesChanged: string[];
    proposedFiles: { path: string; content: string }[];
    diff: string | null;
    applied: boolean;
    model?: ChatModelInfo;
    usage?: TokenUsage;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [plan, setPlan] = useState<string>("free");
  const [purpose, setPurpose] = useState<ChatPurpose>("code");
  const [selected, setSelected] = useState<Partial<Record<ChatPurpose, string>>>({});
  const [effort, setEffort] = useState<ChatEffort>(() => {
    const saved = typeof window !== "undefined" ? loadLS(LS.effort) : null;
    return saved === "low" || saved === "medium" || saved === "high" ? saved : "medium";
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [attachFile, setAttachFile] = useState(false);

  useEffect(() => {
    api
      .getModels()
      .then(({ models, plan }) => {
        setModels(models);
        setPlan(plan || "free");
        const pick = (p: ChatPurpose) => {
          const saved = loadLS(p === "code" ? LS.code : LS.research);
          if (saved && models.some((m) => m.id === saved && supports(m, p))) return saved;
          return models.find((m) => supports(m, p))?.id;
        };
        const code = pick("code");
        const research = pick("research");
        setSelected({ code, research });
        setPurpose(code ? "code" : "research");
      })
      .catch(() => setModels([]));
  }, []);

  const modelId = selected[purpose];
  const currentModel = models?.find((m) => m.id === modelId);
  const canAttach = purpose === "research" && !!currentFile && fileContent !== undefined;
  const locked = (m: ModelOption) => (RANK[m.tier] ?? 0) > (RANK[plan] ?? 0);
  const effortKey = EFFORT_OPTIONS.find((o) => o.value === effort)?.key ?? "effortMedium";

  function chooseModel(id: string) {
    const m = models?.find((x) => x.id === id);
    if (!m || locked(m)) return;
    setSelected((prev) => ({ ...prev, [purpose]: id }));
    saveLS(purpose === "code" ? LS.code : LS.research, id);
    setSheetOpen(false);
  }

  function switchPurpose(p: ChatPurpose) {
    setPurpose(p);
  }

  function chooseEffort(e: ChatEffort) {
    setEffort(e);
    saveLS(LS.effort, e);
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
    setRateLimit(null);
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
          model: result.model,
          usage: result.usage,
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
          model: result.model,
          usage: result.usage,
        });
      }
    } catch (e: any) {
      if (e?.status === 429) {
        setRateLimit({
          kh: e?.data?.messageKh || e.message,
          en: e?.data?.messageEn || e.message,
        });
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  const visible = (models ?? []).filter((m) => supports(m, purpose));
  const providers: string[] = [];
  for (const m of visible) {
    if (!providers.includes(m.provider)) providers.push(m.provider);
  }
  const codeCount = (models ?? []).filter((m) => supports(m, "code")).length;
  const researchCount = (models ?? []).filter((m) => supports(m, "research")).length;

  return (
    <div className="claude-chat">
      <div className="chat-header">
        <button
          type="button"
          className="chat-model-btn"
          onClick={() => setSheetOpen(true)}
          disabled={loading || !models?.length}
          aria-haspopup="dialog"
        >
          {currentModel ? (
            <ModelIcon icon={currentModel.icon} label={currentModel.label} size={22} />
          ) : (
            <span className="chat-header-icon">✦</span>
          )}
          <span className="chat-model-name">{currentModel?.label ?? t("modelLabel")}</span>
          {currentModel?.effortSupport && (
            <span className="badge badge-neutral">{t(effortKey)}</span>
          )}
          <span className="chat-model-caret" aria-hidden="true">▾</span>
        </button>
        <div className="chat-header-status">
          <span className={`claude-status-dot ${loading ? "thinking" : "idle"}`} />
          <small>{loading ? t("claudeThinking") : lang === "kh" ? "រួចរាល់" : "Ready"}</small>
        </div>
      </div>

      {sheetOpen && (
        <div className="sheet-overlay" onClick={() => setSheetOpen(false)}>
          <div
            className="sheet"
            role="dialog"
            aria-label={t("modelLabel")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" aria-hidden="true" />
            <div className="mode-toggle" role="group" aria-label={t("modelLabel")}>
              {(["code", "research"] as ChatPurpose[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={purpose === p ? "active" : ""}
                  aria-pressed={purpose === p}
                  disabled={p === "code" ? codeCount === 0 : researchCount === 0}
                  onClick={() => switchPurpose(p)}
                >
                  {t(p === "code" ? "modeCode" : "modeResearch")}
                </button>
              ))}
            </div>
            {currentModel?.effortSupport && (
              <div className="effort-toggle" role="group" aria-label={t("effortLabel")}>
                {EFFORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={effort === o.value ? "active" : ""}
                    aria-pressed={effort === o.value}
                    onClick={() => chooseEffort(o.value)}
                  >
                    {t(o.key)}
                  </button>
                ))}
              </div>
            )}
            <div className="sheet-list">
              {providers.map((provider) => (
                <div key={provider}>
                  <div className="sheet-group">{provider}</div>
                  {visible
                    .filter((m) => m.provider === provider)
                    .map((m) => {
                      const isLocked = locked(m);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className={`model-row ${m.id === modelId ? "selected" : ""} ${isLocked ? "locked" : ""}`}
                          disabled={isLocked}
                          onClick={() => chooseModel(m.id)}
                        >
                          <ModelIcon icon={m.icon} label={m.label} size={24} />
                          <span className="model-row-name">{m.label}</span>
                          <span className={`badge ${m.tier === "free" ? "badge-success" : m.tier === "pro" ? "badge-info" : "badge-warning"}`}>
                            {t(TIER_KEY[m.tier])}
                          </span>
                          {isLocked ? (
                            <span className="model-lock">🔒 {t("upgrade")}</span>
                          ) : (
                            m.id === modelId && <span className="model-check" aria-hidden="true">✓</span>
                          )}
                        </button>
                      );
                    })}
                </div>
              ))}
              {visible.length === 0 && <div className="chat-error">{t("noModels")}</div>}
            </div>
          </div>
        </div>
      )}

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
            <small>{m.role === "user" ? (lang === "kh" ? "អ្នក" : "You") : t("aiAssistant")}</small>
            <p>{m.content}</p>
            {m.role === "assistant" && (m.model || m.usage) && (
              <div className="chat-msg-meta">
                {m.model && (
                  <>
                    <ModelIcon icon={m.model.icon} label={m.model.label} size={14} />
                    <span>{m.model.label}</span>
                  </>
                )}
                {m.usage && (
                  <span className="chat-tokens">
                    {m.usage.inputTokens} in · {m.usage.outputTokens} out
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-loading">
            <div className="spinner" />
            {t("claudeThinking")}
          </div>
        )}
      </div>

      {rateLimit && (
        <div className="rate-banner" role="alert">
          <span aria-hidden="true">⚠</span>
          <div>
            <strong>{t("rateLimitTitle")}</strong>
            <p>{lang === "kh" ? rateLimit.kh : rateLimit.en}</p>
            <small>{lang === "kh" ? rateLimit.en : rateLimit.kh}</small>
          </div>
        </div>
      )}
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
