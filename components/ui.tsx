"use client";

import type { ReactNode } from "react";

type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral";

const variantClasses: Record<BadgeVariant, string> = {
  success: "badge-success",
  warning: "badge-warning",
  error: "badge-error",
  info: "badge-info",
  neutral: "badge-neutral",
};

/** Brand/logo icon from /public/icons (decorative; the adjacent text carries the meaning). */
export function BrandIcon({
  name,
  size = 18,
}: {
  name: "claude" | "telegram" | "supabase" | "plug" | "github";
  size?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icon/${name === "github" ? "image" : name}.png`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className="brand-icon"
      draggable={false}
    />
  );
}

export function Badge({
  variant = "neutral",
  children,
}: {
  variant?: BadgeVariant;
  children: ReactNode;
}) {
  return <span className={`badge ${variantClasses[variant]}`}>{children}</span>;
}

export function StatusBadge({
  status,
  label,
}: {
  status: "connected" | "disconnected" | "pending" | "idle" | "ready" | "syncing" | "error";
  label?: string;
}) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    connected: { variant: "success", label: "Connected" },
    disconnected: { variant: "warning", label: "Not configured" },
    pending: { variant: "info", label: "Pending" },
    idle: { variant: "neutral", label: "Idle" },
    ready: { variant: "success", label: "Ready" },
    syncing: { variant: "info", label: "Syncing" },
    error: { variant: "error", label: "Error" },
  };
  const cfg = map[status] || map.idle;
  return (
    <span className={`status-badge ${variantClasses[cfg.variant]}`}>
      <span className="status-badge-dot" />
      {label || cfg.label}
    </span>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const buttonClasses: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-danger",
  ghost: "btn-ghost",
};

export function Button({
  variant = "primary",
  children,
  disabled,
  onClick,
  type = "button",
  className = "",
}: {
  variant?: ButtonVariant;
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      className={`btn ${buttonClasses[variant]} ${className}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      {label && <span className="spinner-label">{label}</span>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h4>{title}</h4>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="error-state">
      <span className="error-icon">!</span>
      <p>{message}</p>
    </div>
  );
}

export function Panel({
  title,
  children,
  action,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`panel ${className}`}>
      {title && (
        <div className="panel-header">
          <h3>{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
