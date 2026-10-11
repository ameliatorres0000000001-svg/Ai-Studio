"use client";

import { BotBuilderChat } from "@/components/BotBuilderChat";

/**
 * Standalone, no-code entry point: /bot-builder. Deliberately separate from
 * the main IDE page (app/page.tsx) — no file tree, terminal or diff viewer,
 * just a chat that ends with a working GitHub repo.
 */
export default function BotBuilderPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
      <BotBuilderChat />
    </main>
  );
}
