import type { ReactNode } from "react";

// Legacy studio surface: keeps the Tokyo Night palette while the app default is the light TeleScripts theme.
export default function DarkSurfaceLayout({ children }: { children: ReactNode }) {
  return <div data-theme="dark" className="theme-surface">{children}</div>;
}
