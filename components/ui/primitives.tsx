"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { Icon, type IconName } from "./icons";
import "./ui.css";

export { Icon, type IconName } from "./icons";

/* ── Buttons ─────────────────────────────────────────────── */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";
type ButtonLook = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; icon?: IconName; trailingIcon?: IconName };

function buttonClass({ variant = "primary", size = "md", block }: ButtonLook, extra = "") {
  return `ui-btn ui-${variant} ui-${size}${block ? " ui-block" : ""}${extra ? ` ${extra}` : ""}`;
}

/** Pill button (DESIGN.md: 48px, full radius). `sm` is the 40px in-card variant. */
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & ButtonLook & { loading?: boolean }>(
  function Button({ variant = "primary", size = "md", block, icon, trailingIcon, loading, disabled, children, className = "", type = "button", ...props }, ref) {
    return (
      <button ref={ref} type={type} className={buttonClass({ variant, size, block }, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
        {loading ? <Spinner size="sm" /> : icon ? <Icon name={icon} size={18} /> : null}
        {children}
        {trailingIcon && !loading && <Icon name={trailingIcon} size={18} />}
      </button>
    );
  }
);

/** Same look as Button for navigation (internal routes use next/link, external open a new tab). */
export function ButtonLink({ href, variant, size, block, icon, trailingIcon, children, className = "", external, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & ButtonLook & { href: string; external?: boolean }) {
  const content = <>{icon && <Icon name={icon} size={18} />}{children}{trailingIcon && <Icon name={trailingIcon} size={18} />}</>;
  const cls = buttonClass({ variant, size, block }, className);
  if (external) return <a href={href} className={cls} target="_blank" rel="noopener noreferrer" {...props}>{content}</a>;
  return <Link href={href} className={cls} {...props}>{content}</Link>;
}

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: "plain" | "tint" | "accent" }>(
  function IconButton({ label, tone = "plain", children, className = "", type = "button", ...props }, ref) {
    return <button ref={ref} type={type} className={`ui-icon-btn ui-icon-${tone} ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
  }
);

/* ── Form fields ─────────────────────────────────────────── */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = "", ...props }, ref) {
  return <input ref={ref} className={`ui-input ${className}`} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { bare?: boolean }>(function Textarea({ onInput, bare, className = "", ...props }, ref) {
  const own = useRef<HTMLTextAreaElement | null>(null);
  const set = (node: HTMLTextAreaElement | null) => { own.current = node; if (typeof ref === "function") ref(node); else if (ref) ref.current = node; };
  // Keep auto-grow in sync when the value is set programmatically (e.g. a starter chip).
  useEffect(() => { const el = own.current; if (!el) return; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }, [props.value]);
  return <textarea ref={set} className={`${bare ? "ui-textarea-bare" : "ui-textarea"} ${className}`} onInput={(event) => { const el = event.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; onInput?.(event); }} {...props} />;
});

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="ui-field"><span className="ui-field-label">{label}</span>{children}{hint && <span className="ui-field-hint">{hint}</span>}</label>;
}

/* ── Surfaces ────────────────────────────────────────────── */
export function Card({ children, className = "", tone = "surface", onClick }: { children: ReactNode; className?: string; tone?: "surface" | "tint" | "low" | "accent" | "success"; onClick?: () => void }) {
  return <section className={`ui-card ui-card-${tone} ${className}`} onClick={onClick}>{children}</section>;
}

export function SectionHeader({ icon, title, action }: { icon?: IconName; title: string; action?: ReactNode }) {
  return <div className="ui-section-head"><h2>{icon && <Icon name={icon} size={20} className="ui-accent" />}{title}</h2>{action}</div>;
}

/* ── Badges, chips, status ───────────────────────────────── */
export type Tone = "neutral" | "blue" | "green" | "yellow" | "red" | "purple";

export function Badge({ children, tone = "neutral", dot, pulse }: { children: ReactNode; tone?: Tone; dot?: boolean; pulse?: boolean }) {
  return <span className={`ui-badge ui-tone-${tone}`}>{dot && <span className={`ui-badge-dot${pulse ? " ui-pulse" : ""}`} />}{children}</span>;
}

export function Chip({ children, active, icon, onClick, className = "" }: { children: ReactNode; active?: boolean; icon?: IconName; onClick?: () => void; className?: string }) {
  return <button type="button" className={`ui-chip${active ? " active" : ""} ${className}`} aria-pressed={active} onClick={onClick}>{icon && <Icon name={icon} size={16} />}{children}</button>;
}

export function StatusDot({ tone = "green", pulse }: { tone?: "green" | "yellow" | "red" | "blue" | "neutral"; pulse?: boolean }) {
  return <span className={`ui-status-dot ui-dot-${tone}${pulse ? " ui-pulse" : ""}`} aria-hidden="true" />;
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return <div className="ui-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}><i style={{ width: `${pct}%` }} /></div>;
}

/* ── Segmented tabs ──────────────────────────────────────── */
export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return <div className="ui-tabs" role="tablist">{tabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={tab.id === value} className={tab.id === value ? "active" : ""} onClick={() => onChange(tab.id)}>{tab.label}</button>)}</div>;
}

/* ── Overlays ────────────────────────────────────────────── */
function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => { if (!open) return; const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose(); document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); }, [open, onClose]);
}

export function Dialog({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  useEscape(open, onClose);
  if (!open) return null;
  return <div className="ui-dialog-backdrop" onMouseDown={onClose}><div className="ui-dialog" role="dialog" aria-modal="true" aria-label={title} onMouseDown={e => e.stopPropagation()}><div className="ui-dialog-head"><strong>{title}</strong><IconButton label="បិទ" onClick={onClose}><Icon name="x" /></IconButton></div>{children}</div></div>;
}

/** Bottom sheet: 24px top radius, 36×4 grab handle, sits above the safe area. */
export function BottomSheet({ open, title, children, onClose }: { open: boolean; title?: string; children: ReactNode; onClose: () => void }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="ui-sheet-backdrop" onMouseDown={onClose}>
      <div className="ui-sheet" role="dialog" aria-modal="true" aria-label={title} onMouseDown={e => e.stopPropagation()}>
        <span className="ui-sheet-handle" aria-hidden="true" />
        {title && <h3 className="ui-sheet-title">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function Toast({ open, message, tone = "neutral", onClose, duration = 3500 }: { open: boolean; message: ReactNode; tone?: "neutral" | "success" | "error"; onClose: () => void; duration?: number }) {
  useEffect(() => { if (!open || !duration) return; const id = setTimeout(onClose, duration); return () => clearTimeout(id); }, [open, duration, onClose]);
  if (!open) return null;
  return (
    <div className={`ui-toast ui-toast-${tone}`} role="status" aria-live="polite">
      <Icon name={tone === "error" ? "alert" : "checkCircle"} size={18} />
      <span>{message}</span>
      <button type="button" className="ui-toast-close" onClick={onClose} aria-label="បិទ"><Icon name="x" size={16} /></button>
    </div>
  );
}

export function Accordion({ icon, title, children, defaultOpen = false }: { icon?: IconName; title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="ui-accordion">
      <button type="button" className="ui-accordion-head" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <span>{icon && <Icon name={icon} size={20} className="ui-accent" />}{title}</span>
        <Icon name="chevronDown" size={20} className={open ? "ui-rot" : ""} />
      </button>
      {open && <div className="ui-accordion-body">{children}</div>}
    </div>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) { return <span className="ui-tooltip" data-tooltip={label}>{children}</span>; }
export function Kbd({ children }: { children: ReactNode }) { return <kbd className="ui-kbd">{children}</kbd>; }
export function Spinner({ size = "md" }: { size?: "sm" | "md" }) { return <span className={`ui-spinner ui-spinner-${size}`} role="status" aria-label="កំពុងផ្ទុក" />; }
export function Avatar({ name, src, size = 32 }: { name: string; src?: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img className="ui-avatar" src={src} alt={name} style={{ width: size, height: size }} /> : <span className="ui-avatar" aria-label={name} style={{ width: size, height: size }}><Icon name="person" size={Math.round(size * 0.56)} /></span>;
}
export function Skeleton({ width = "100%", height = "1rem", radius }: { width?: string; height?: string; radius?: string }) { return <span className="ui-skeleton" style={{ width, height, borderRadius: radius }} />; }

/* ── Chat ────────────────────────────────────────────────── */
export function ChatBubble({ role, children, meta }: { role: "user" | "assistant"; children: ReactNode; meta?: ReactNode }) {
  if (role === "user") return <div className="ui-msg ui-msg-user"><div className="ui-bubble ui-bubble-user">{children}</div>{meta && <span className="ui-msg-meta">{meta}</span>}</div>;
  return <div className="ui-msg ui-msg-ai"><span className="ui-msg-avatar"><Icon name="bot" size={18} /></span><div className="ui-msg-col"><div className="ui-bubble ui-bubble-ai">{children}</div>{meta}</div></div>;
}

/* ── States (11-states): empty / loading / offline / error ── */
const STATE_COPY = {
  empty: { icon: "folder" as IconName, title: "មិនទាន់មានអ្វីនៅទីនេះទេ", description: "ចាប់ផ្តើមបង្កើត Bot ដំបូងរបស់អ្នក ដោយប្រាប់ AI ពីអ្វីដែលអ្នកចង់បាន។" },
  error: { icon: "alert" as IconName, title: "មានបញ្ហាបន្តិចបន្តួច", description: "សូមព្យាយាមម្តងទៀត។ ទិន្នន័យរបស់អ្នកនៅតែមានសុវត្ថិភាព។" },
  offline: { icon: "wifiOff" as IconName, title: "អ្នកកំពុងនៅក្រៅបណ្តាញ", description: "សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយព្យាយាមម្តងទៀត។" },
};

export function StateView({ kind, title, description, icon, action, onRetry }: { kind: "empty" | "error" | "offline" | "loading"; title?: string; description?: string; icon?: IconName; action?: ReactNode; onRetry?: () => void }) {
  if (kind === "loading") return <ListSkeleton />;
  const copy = STATE_COPY[kind];
  return (
    <div className={`ui-state ui-state-${kind}`} role={kind === "empty" ? undefined : "alert"}>
      <span className="ui-state-icon"><Icon name={icon || copy.icon} size={28} /></span>
      <h3>{title || copy.title}</h3>
      <p>{description || copy.description}</p>
      {action}
      {!action && onRetry && <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>ព្យាយាមម្តងទៀត</Button>}
    </div>
  );
}

export function ListSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="ui-skeleton-list" aria-busy="true" aria-label="កំពុងផ្ទុក">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="ui-card ui-card-surface ui-skeleton-card">
          <Skeleton width="48px" height="48px" radius="12px" />
          <div className="ui-skeleton-lines"><Skeleton width="60%" height="18px" /><Skeleton width="40%" height="12px" /></div>
        </div>
      ))}
    </div>
  );
}

/** True while the browser reports a network connection. */
export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return online;
}

type SpeechRec = { lang: string; interimResults: boolean; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };

/** Khmer voice dictation through the browser Web Speech API (no backend, no package). */
export function useSpeechInput(onText: (text: string) => void, onError: (message: string) => void) {
  const [listening, setListening] = useState(false);
  const rec = useRef<SpeechRec | null>(null);
  const cb = useRef({ onText, onError });
  cb.current = { onText, onError };
  useEffect(() => () => rec.current?.stop(), []);
  const toggle = useCallback(() => {
    if (listening) { rec.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) { cb.current.onError("កម្មវិធីរុករកនេះមិនទាន់គាំទ្រការបញ្ចូលជាសំឡេងទេ។"); return; }
    const r = new Ctor();
    r.lang = "km-KH";
    r.interimResults = false;
    r.onresult = (e: any) => { const text = Array.from(e.results as ArrayLike<any>).map((x: any) => x[0]?.transcript || "").join(" ").trim(); if (text) cb.current.onText(text); };
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); cb.current.onError("មិនអាចស្តាប់សំឡេងបានទេ សូមព្យាយាមម្តងទៀត។"); };
    rec.current = r;
    setListening(true);
    r.start();
  }, [listening]);
  return { listening, toggle };
}

/* ── App shell: top bar, bottom nav, centered mobile column ── */
export function TopBar({ title, subtitle, back, leading, actions }: { title?: ReactNode; subtitle?: ReactNode; back?: string | true; leading?: ReactNode; actions?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="ui-topbar">
      <div className="ui-topbar-inner">
        <div className="ui-topbar-lead">
          {back && (typeof back === "string"
            ? <Link href={back} className="ui-icon-btn ui-icon-plain" aria-label="ត្រឡប់ក្រោយ"><Icon name="arrowLeft" size={24} /></Link>
            : <IconButton label="ត្រឡប់ក្រោយ" onClick={() => router.back()}><Icon name="arrowLeft" size={24} /></IconButton>)}
          {leading}
          {(title || subtitle) && (
            <div className="ui-topbar-titles">
              {title && <h1 className="ui-topbar-title">{title}</h1>}
              {subtitle && <span className="ui-topbar-sub"><StatusDot tone="green" />{subtitle}</span>}
            </div>
          )}
        </div>
        {actions && <div className="ui-topbar-actions">{actions}</div>}
      </div>
    </header>
  );
}

const NAV_ITEMS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/", label: "ផ្ទះ", icon: "home", match: p => p === "/" },
  { href: "/bot-builder/bots", label: "Bot របស់ខ្ញុំ", icon: "bot", match: p => p.startsWith("/bot-builder/bot") },
  { href: "/help", label: "ជំនួយ", icon: "help", match: p => p.startsWith("/help") },
  { href: "/settings", label: "គណនី", icon: "account", match: p => p === "/settings" || p.startsWith("/settings/") },
];

export function BottomNav() {
  const pathname = usePathname() || "/";
  return (
    <nav className="ui-bottomnav" aria-label="ម៉ឺនុយចម្បង">
      <div className="ui-bottomnav-inner">
        {NAV_ITEMS.map(item => {
          const active = item.match(pathname);
          return (
            <Link key={item.href} href={item.href} className={`ui-nav-item${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
              <Icon name={item.icon} size={24} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Mobile-first page frame: fixed top bar, centered column (420px phone /
 * 680px desktop), optional bottom nav or sticky footer (e.g. a prompt bar).
 */
export function AppShell({ header, children, nav = true, footer, className = "" }: { header?: ReactNode; children: ReactNode; nav?: boolean; footer?: ReactNode; className?: string }) {
  return (
    <div className={`ts-app${header ? " has-topbar" : ""}${nav ? " has-nav" : ""}${footer ? " has-footer" : ""} ${className}`}>
      {header}
      <main className="ts-main">{children}</main>
      {footer && <div className="ts-footer"><div className="ts-footer-inner">{footer}</div></div>}
      {nav && <BottomNav />}
    </div>
  );
}
