"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell, Chip, Icon, SectionHeader } from "@/components/ui/primitives";
import { BrandHeader } from "@/components/Dashboard";
import { BotProjects, useBotProjects } from "@/components/BotProjects";

/** 07 My bots — portfolio with status, today's metrics and quick access to each bot. */
export default function MyBotsPage() {
  const bots = useBotProjects();
  const [filter, setFilter] = useState<"all" | "live" | "draft">("all");
  const ready = bots.state === "ready";
  const count = ready ? bots.projects.length : 0;
  const liveCount = ready ? bots.projects.filter((p) => p.status === "live").length : 0;
  const ordersToday = ready ? bots.projects.reduce((sum, p) => sum + (p.ordersToday ?? 0), 0) : 0;
  const visible = filter === "live" ? bots.projects.filter((p) => p.status === "live") : filter === "draft" ? bots.projects.filter((p) => p.status !== "live") : bots.projects;

  return (
    <AppShell header={<BrandHeader />}>
      <section className="ts-greet">
        <h1>Bot របស់ខ្ញុំ</h1>
        <p>គ្រប់គ្រង Bot ទាំងអស់របស់អ្នក មើលស្ថានភាព និងកុម្ម៉ង់ថ្ងៃនេះ។</p>
      </section>

      <div className="ts-metrics">
        <div className="ts-metric"><b>{count.toLocaleString("km-KH")}</b><span>Bot សរុប</span></div>
        <div className="ts-metric"><b>{liveCount.toLocaleString("km-KH")}</b><span>កំពុងដំណើរការ</span></div>
        <div className="ts-metric"><b>{ordersToday.toLocaleString("km-KH")}</b><span>កុម្ម៉ង់ថ្ងៃនេះ</span></div>
      </div>

      <div className="ts-filter" role="group" aria-label="តម្រង">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>ទាំងអស់</Chip>
        <Chip active={filter === "live"} onClick={() => setFilter("live")}>ដំណើរការ</Chip>
        <Chip active={filter === "draft"} onClick={() => setFilter("draft")}>កំពុងបង្កើត / ព្រាង</Chip>
      </div>

      <section className="ts-stack">
        <SectionHeader icon="bot" title="បញ្ជី Bot" />
        <BotProjects {...bots} projects={visible} emptyTitle={filter === "live" ? "មិនទាន់មាន Bot កំពុងដំណើរការទេ" : filter === "draft" ? "គ្មាន Bot កំពុងបង្កើតទេ" : undefined} />
      </section>

      <Link href="/bot-builder" className="ui-btn ui-primary ui-md ui-block"><Icon name="plus" size={18} />បង្កើត Bot ថ្មី</Link>
    </AppShell>
  );
}
