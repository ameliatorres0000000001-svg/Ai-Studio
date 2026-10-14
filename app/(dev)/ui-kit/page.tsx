"use client";
import { useState } from "react";
import { Avatar, Badge, Button, Card, Dialog, IconButton, Input, Kbd, Skeleton, Spinner, StatusDot, Tabs, Textarea, Tooltip } from "@/components/ui/primitives";

export default function UIKitPage() {
  const [tab, setTab] = useState("One"); const [open, setOpen] = useState(false);
  return <main style={{ minHeight: "100vh", display: "block", padding: 32, background: "var(--tn-bg)", color: "var(--tn-text)" }}><h1>UI Kit</h1>
    <Card><h2>Buttons</h2>{(["primary","secondary","ghost","danger"] as const).map(v=><Button key={v} variant={v}>{v}</Button>)} <Button size="sm">Small</Button><Button loading>Loading</Button></Card>
    <Card><h2>Inputs</h2><Input placeholder="Input"/><Textarea placeholder="Auto-grow textarea"/></Card>
    <Card><h2>Badges</h2>{(["neutral","blue","green","yellow","red","purple"] as const).map(t=><Badge key={t} tone={t}>{t}</Badge>)}</Card>
    <Card><h2>Tabs and Dialog</h2><Tabs tabs={[{id:"One",label:"One"},{id:"Two",label:"Two"}]} value={tab} onChange={setTab}/><Button onClick={()=>setOpen(true)}>Open dialog</Button><Dialog open={open} title="Dialog" onClose={()=>setOpen(false)}>Accessible dialog content</Dialog></Card>
    <Card><h2>Other</h2><IconButton label="Example">⋯</IconButton><Tooltip label="Tooltip"><Button>Hover</Button></Tooltip><Kbd>⌘ K</Kbd><Spinner/><Avatar name="Claude"/><StatusDot/><Skeleton width="180px"/></Card>
  </main>;
}
