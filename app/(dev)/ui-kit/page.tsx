"use client";
import { useState } from "react";
import {
  Accordion, AppShell, Avatar, Badge, BottomSheet, Button, Card, ChatBubble, Chip, Dialog, Field, IconButton, Icon,
  Input, Kbd, ListSkeleton, ProgressBar, SectionHeader, Spinner, StateView, StatusDot, Tabs, Textarea, Toast, Tooltip, TopBar,
} from "@/components/ui/primitives";

/** Reference page for the TeleScripts primitives (docs/design/telescripts/components.html + 11-states). */
export default function UIKitPage() {
  const [tab, setTab] = useState("orders");
  const [chip, setChip] = useState("shop");
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState(false);
  return (
    <AppShell header={<TopBar title="បណ្ណាល័យ Component" subtitle="TeleScripts Agent" back="/" />}>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>Component &amp; Interaction Patterns សម្រាប់ TeleScripts Agent UI (ភាសាខ្មែរ)</p>

      <SectionHeader icon="sparkles" title="1. ប៊ូតុងសកម្មភាព (Action Buttons)" />
      <Card>
        <div style={{ display: "grid", gap: 10 }}>
          <Button block>ប៊ូតុងចម្បង (Primary Button) 🚀</Button>
          <Button block variant="secondary">ប៊ូតុងបន្ទាប់បន្សំ (Secondary Button)</Button>
          <Button block variant="ghost">ប៊ូតុងធម្មតា (Ghost Button)</Button>
          <Button block variant="danger">ប៊ូតុងលុប / ព្រមាន (Danger)</Button>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Button size="sm" loading>កំពុងផ្ទុក</Button>
            <IconButton label="ជម្រើស"><Icon name="more" /></IconButton>
            <IconButton label="ផ្ញើសារ" tone="accent"><Icon name="arrowUp" /></IconButton>
            <Tooltip label="Tooltip"><Kbd>⌘ K</Kbd></Tooltip>
            <Spinner /><Avatar name="User" /><StatusDot pulse />
          </div>
        </div>
      </Card>

      <SectionHeader icon="verified" title="2. ផ្លាកសញ្ញាស្ថានភាព (Status Badges)" />
      <Card><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Badge tone="green" dot>ដំណើរការ (Active)</Badge><Badge tone="yellow" dot>ព្រាង (Draft)</Badge><Badge tone="red" dot>ផ្អាក (Offline)</Badge><Badge tone="blue">PRO</Badge><Badge>រង់ចាំ</Badge>
      </div></Card>

      <SectionHeader icon="lightbulb" title="3. បន្ទះជម្រើសរហ័ស (Quick Chips)" />
      <Card><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[["shop", "Bot លក់ទំនិញ 🛍️"], ["faq", "ឆ្លើយសំណួរ 24/7 💬"], ["booking", "Bot កក់ម៉ោង 📅"], ["mini", "Mini App 📱"]].map(([id, label]) => <Chip key={id} active={chip === id} onClick={() => setChip(id)}>{label}</Chip>)}
      </div></Card>

      <SectionHeader icon="message" title="4. ពពុះសន្ទនា (Chat Bubbles)" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <ChatBubble role="assistant">ជម្រាបសួរ! តើអ្នកចង់បង្កើត Bot សម្រាប់អាជីវកម្មអ្វីដែរ?</ChatBubble>
        <ChatBubble role="user" meta="ម៉ោង 10:42 ព្រឹក">ខ្ញុំចង់បាន bot លក់សម្លៀកបំពាក់នារី និងគិតលុយតាម ABA KHQR។</ChatBubble>
      </div>

      <SectionHeader icon="sliders" title="5. បន្ទះប្តូរជម្រើស (Segmented Control)" />
      <Tabs tabs={[{ id: "orders", label: "ទិន្នន័យបញ្ជាទិញ" }, { id: "settings", label: "ការកំណត់" }, { id: "logs", label: "កំណត់ត្រា" }]} value={tab} onChange={setTab} />
      <ProgressBar value={62} label="ការរីកចម្រើន" />

      <SectionHeader icon="pencil" title="6. ប្រអប់បញ្ចូលទិន្នន័យ (Input Fields)" />
      <Card><div style={{ display: "grid", gap: 10 }}>
        <Field label="ឈ្មោះហាង"><Input placeholder="ប្រាប់ខ្ញុំថាអ្នកចង់បាន bot អ្វី..." /></Field>
        <Textarea placeholder="វាយបញ្ចូលចម្លើយរបស់អ្នកនៅទីនេះ..." />
      </div></Card>

      <SectionHeader icon="hub" title="7. Overlays" />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button size="sm" variant="secondary" onClick={() => setSheet(true)}>Bottom sheet</Button>
        <Button size="sm" variant="secondary" onClick={() => setDialog(true)}>Dialog</Button>
        <Button size="sm" variant="secondary" onClick={() => setToast(true)}>Toast</Button>
      </div>
      <Accordion icon="terminal" title="មើលលម្អិតបច្ចេកទេស (Technical Details)"><code>✓ Telegram Webhook registered successfully</code></Accordion>

      <SectionHeader icon="alert" title="8. ស្ថានភាព (Empty / Loading / Offline / Error)" />
      <StateView kind="empty" action={<Button size="sm" icon="plus">បង្កើត Bot ថ្មី</Button>} />
      <ListSkeleton />
      <StateView kind="offline" onRetry={() => undefined} />
      <StateView kind="error" onRetry={() => undefined} />

      <Dialog open={dialog} title="Dialog" onClose={() => setDialog(false)}>មាតិកា Dialog</Dialog>
      <BottomSheet open={sheet} title="កំពុងបញ្ជូនទៅកាន់ Telegram..." onClose={() => setSheet(false)}>
        <p style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>សូមចុច &quot;Allow&quot; នៅលើផ្ទាំង Telegram ផ្លូវការ។</p>
        <Button block variant="secondary" onClick={() => setSheet(false)}>យល់ព្រម</Button>
      </BottomSheet>
      <Toast open={toast} tone="success" message="បានរក្សាទុក!" onClose={() => setToast(false)} />
    </AppShell>
  );
}
