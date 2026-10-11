"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { BotBuilderMessage, BotSpec } from "@/lib/bot-builder/types";
import { Button, Spinner, ErrorState, Panel, Badge } from "@/components/ui";

interface GenerateResult {
  repoUrl: string;
  owner: string;
  repo: string;
  warnings: string[];
  envVars: string[];
  nextSteps: { km: string; en: string }[];
}

/**
 * A plain chat box for the no-code Bot Builder: the user describes the bot
 * they want in everyday language, the assistant asks follow-up questions, and
 * once it has enough information it generates a GitHub repo for them — no
 * file tree, no diff viewer, no terminal.
 */
export function BotBuilderChat() {
  const { lang } = useLang();
  const kh = lang === "kh";
  const [messages, setMessages] = useState<BotBuilderMessage[]>([
    {
      role: "assistant",
      content: "👋 ជំរាបសួរ! ប្រាប់ខ្ញុំអំពី bot ដែលអ្នកចង់បាន (ឧ. \"ចង់បានហាងលក់កាហ្វេតាម Telegram\")។",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spec, setSpec] = useState<BotSpec | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const turn = await api.botBuilderChat(messages, text);
      setMessages([...next, { role: "assistant", content: turn.reply }]);
      if (turn.done && turn.spec) {
        setSpec(turn.spec);
      }
    } catch (e: any) {
      setError(friendlyError(e, kh));
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    if (!spec) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await api.botBuilderGenerate(spec));
    } catch (e: any) {
      setError(friendlyError(e, kh));
    } finally {
      setLoading(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <Panel title={kh ? "បង្កើត Telegram Bot (មិនចាំបាច់ចេះ code)" : "Build a Telegram Bot (no coding needed)"}>
      <div ref={scrollRef} className="bot-builder-thread" style={{ maxHeight: 420, overflowY: "auto" }}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            <small>{m.role === "user" ? (kh ? "អ្នក" : "You") : "Bot Builder"}</small>
            <p>{m.content}</p>
          </div>
        ))}
      </div>

      {error && <ErrorState message={error} />}

      {!spec && (
        <div className="bot-builder-input" style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={kh ? "វាយសារនៅទីនេះ..." : "Type your message…"}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <Button onClick={send} disabled={loading || !input.trim()}>
            {loading ? <Spinner /> : kh ? "ផ្ញើ" : "Send"}
          </Button>
        </div>
      )}

      {spec && !result && (
        <div style={{ marginTop: 16 }}>
          <p>
            {kh ? (
              <>
                ត្រៀមបង្កើត <b>{spec.bot_name}</b> ({spec.bot_type}) ហើយ — ចុចប៊ូតុងខាងក្រោមដើម្បីបង្កើត repo ។
              </>
            ) : (
              <>
                Ready to build <b>{spec.bot_name}</b> ({spec.bot_type}) — press the button to create the repo.
              </>
            )}
          </p>
          <Button onClick={generate} disabled={loading}>
            {loading ? <Spinner label={kh ? "កំពុងបង្កើត..." : "Creating…"} /> : kh ? "បង្កើត Bot ឥឡូវនេះ" : "Create the bot now"}
          </Button>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16 }}>
          <p>
            ✅ {kh ? "បានបង្កើតរួចរាល់!" : "Done!"}{" "}
            <a href={result.repoUrl} target="_blank" rel="noreferrer">
              {kh ? "បើក repo" : "Open the repo"}
            </a>
          </p>

          {result.warnings.length > 0 && (
            <div className="bot-builder-note">
              {result.warnings.map((w, i) => (
                <div key={i}>⚠ {w}</div>
              ))}
            </div>
          )}

          <h4 className="bot-builder-h">
            {kh ? "ជំហានបន្ទាប់ (ធ្វើម្ដងប៉ុណ្ណោះ)" : "Next steps (one time)"}
          </h4>
          <ol className="bot-builder-steps">
            {result.nextSteps.map((s, i) => (
              <li key={i}>{kh ? s.km : s.en}</li>
            ))}
          </ol>

          {result.envVars.length > 0 && (
            <>
              <h4 className="bot-builder-h">{kh ? "env ដែលត្រូវដាក់លើ Vercel" : "Env vars to set on Vercel"}</h4>
              <div className="bot-builder-envs">
                {result.envVars.map((v) => (
                  <button key={v} type="button" className="bot-builder-env" onClick={() => copy(v)} title={kh ? "ចម្លង" : "Copy"}>
                    <code>{v}</code>
                    <span>{copied === v ? (kh ? "បានចម្លង" : "copied") : kh ? "ចម្លង" : "copy"}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <Badge variant="info">{kh ? "repo ជា private" : "private repo"}</Badge>
        </div>
      )}
    </Panel>
  );
}

/** Turns raw API errors into something a non-technical user can act on. */
function friendlyError(e: any, kh: boolean): string {
  const msg = e?.message || "";
  if (msg.includes("admin-only")) {
    return kh ? "មុខងារនេះសម្រាប់តែ admin ប៉ុណ្ណោះនៅពេលនេះ។" : "This feature is admin-only for now.";
  }
  if (msg.includes("quota") || msg.includes("limit")) {
    return kh ? "អ្នកបានប្រើអស់កម្រិតថ្ងៃនេះហើយ។" : "You've reached today's limit.";
  }
  if (msg.includes("GitHub not configured")) {
    return kh ? "GitHub token មិនទាន់កំណត់លើ server។" : "GitHub token is not configured on the server.";
  }
  return msg || (kh ? "មានបញ្ហា សូមព្យាយាមម្ដងទៀត។" : "Something went wrong, please try again.");
}
