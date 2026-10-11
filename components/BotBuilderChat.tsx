"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import type { BotBuilderMessage, BotSpec } from "@/lib/bot-builder/types";
import { Button, Spinner, ErrorState, Panel } from "@/components/ui";

/**
 * A plain chat box for the no-code Bot Builder: the user describes the bot
 * they want in everyday language, the assistant asks follow-up questions, and
 * once it has enough information it generates a GitHub repo for them — no
 * file tree, no diff viewer, no terminal.
 */
export function BotBuilderChat() {
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
  const [result, setResult] = useState<{ repoUrl: string; nextSteps: string[] } | null>(null);
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
      setError(e.message || "មានបញ្ហា");
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    if (!spec) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.botBuilderGenerate(spec);
      setResult(res);
    } catch (e: any) {
      setError(e.message || "មិនអាចបង្កើត bot បានទេ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel title="បង្កើត Telegram Bot (មិនចាំបាច់ចេះ code)">
      <div ref={scrollRef} className="bot-builder-thread" style={{ maxHeight: 420, overflowY: "auto" }}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            <small>{m.role === "user" ? "អ្នក" : "Bot Builder"}</small>
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
            placeholder="វាយសារនៅទីនេះ..."
            disabled={loading}
            style={{ flex: 1 }}
          />
          <Button onClick={send} disabled={loading || !input.trim()}>
            {loading ? <Spinner /> : "ផ្ញើ"}
          </Button>
        </div>
      )}

      {spec && !result && (
        <div style={{ marginTop: 16 }}>
          <p>
            ត្រៀមបង្កើត <b>{spec.bot_name}</b> ({spec.bot_type}) ហើយ — ចុចប៊ូតុងខាងក្រោមដើម្បីបង្កើត repo ។
          </p>
          <Button onClick={generate} disabled={loading}>
            {loading ? <Spinner label="កំពុងបង្កើត..." /> : "បង្កើត Bot ឥឡូវនេះ"}
          </Button>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16 }}>
          <p>
            ✅ បានបង្កើតរួចរាល់!{" "}
            <a href={result.repoUrl} target="_blank" rel="noreferrer">
              បើក repo
            </a>
          </p>
          <ol>
            {result.nextSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}
    </Panel>
  );
}
