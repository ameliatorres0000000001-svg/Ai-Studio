"use client";

import { BotBuilderChat } from "@/components/BotBuilderChat";
import { BotProjects } from "@/components/BotProjects";

/**
 * Standalone, no-code entry point: /bot-builder. Deliberately separate from
 * the main IDE page (app/page.tsx) — no file tree, terminal or diff viewer,
 * just a chat that ends with a working GitHub repo. The projects panel below
 * edits the catalogue of bots that were already generated.
 */
export default function BotBuilderPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
      <BotBuilderChat />
      <BotProjects />
    </main>
  );
}
