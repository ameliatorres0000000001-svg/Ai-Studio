"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell, ButtonLink, StateView, TopBar } from "@/components/ui/primitives";
import { BotDetail, LegacyBotDetail } from "@/components/BotDetail";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;

function BotDetailRoute() {
  const params = useSearchParams();
  const id = params.get("id") || "";
  const repo = params.get("repo") || "";
  if (UUID_RE.test(id)) return <BotDetail projectId={id} />;
  if (REPO_RE.test(repo)) return <LegacyBotDetail repo={repo} />;
  return (
    <AppShell header={<TopBar back="/bot-builder/bots" title="Bot" />}>
      <StateView kind="error" title="រកមិនឃើញ Bot នេះទេ" description="តំណនេះមិនត្រឹមត្រូវ ឬ Bot ត្រូវបានលុប។" action={<ButtonLink href="/bot-builder/bots" size="sm" variant="secondary">ត្រឡប់ទៅ Bot របស់ខ្ញុំ</ButtonLink>} />
    </AppShell>
  );
}

/** 08 Bot detail: /bot-builder/bot?id=<project> (legacy: ?repo=owner/name) */
export default function BotDetailPage() {
  return <Suspense fallback={null}><BotDetailRoute /></Suspense>;
}
