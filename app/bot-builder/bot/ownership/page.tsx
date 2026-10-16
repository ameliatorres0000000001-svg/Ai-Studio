"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell, ButtonLink, StateView, TopBar } from "@/components/ui/primitives";
import { Ownership } from "@/components/BotDetail";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function OwnershipRoute() {
  const id = useSearchParams().get("id") || "";
  if (!UUID_RE.test(id)) {
    return (
      <AppShell header={<TopBar back="/bot-builder/bots" title="កម្មសិទ្ធិ" />}>
        <StateView kind="error" title="រកមិនឃើញ Bot នេះទេ" description="តំណនេះមិនត្រឹមត្រូវ ឬ Bot ត្រូវបានលុប។" action={<ButtonLink href="/bot-builder/bots" size="sm" variant="secondary">ត្រឡប់ទៅ Bot របស់ខ្ញុំ</ButtonLink>} />
      </AppShell>
    );
  }
  return <Ownership projectId={id} />;
}

/** 09 Ownership: /bot-builder/bot/ownership?id=<project> */
export default function OwnershipPage() {
  return <Suspense fallback={null}><OwnershipRoute /></Suspense>;
}
