"use client";

import { useState } from "react";

/** Model icon from /icon/. Falls back to a colored circle with initials when missing. */
export function ModelIcon({
  icon,
  label,
  size = 20,
}: {
  icon?: string;
  label: string;
  size?: number;
}) {
  const [missing, setMissing] = useState(false);

  if (!icon || missing) {
    const initials = label
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    let hash = 0;
    for (const c of label) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    const hue = hash % 360;
    return (
      <span
        className="model-icon-fallback"
        style={{
          width: size,
          height: size,
          fontSize: Math.max(9, size * 0.42),
          background: `hsl(${hue} 45% 28%)`,
          color: `hsl(${hue} 70% 80%)`,
        }}
        aria-hidden="true"
      >
        {initials || "?"}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icon/${icon}`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className="model-icon"
      draggable={false}
      onError={() => setMissing(true)}
    />
  );
}
