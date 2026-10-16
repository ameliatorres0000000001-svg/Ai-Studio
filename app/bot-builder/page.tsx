import { Suspense } from "react";
import { BotBuilderChat } from "@/components/BotBuilderChat";

/**
 * Standalone, no-code entry point: /bot-builder (03 Builder chat → 04 Secure
 * connect → 05 Build progress → 06 Success). Deliberately separate from the IDE
 * at /workspace — no file tree, terminal or diff viewer. The generated bots are
 * listed at /bot-builder/bots.
 */
export default function BotBuilderPage() {
  return <Suspense fallback={null}><BotBuilderChat /></Suspense>;
}
