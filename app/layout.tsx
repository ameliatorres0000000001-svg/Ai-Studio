import "./globals.css";
import type { Viewport } from "next";
import { Inter, JetBrains_Mono, Kantumruy_Pro, Noto_Sans_Khmer } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n";
import { AuthGate } from "@/components/AuthGate";

// TeleScripts font stack: Kantumruy Pro for Khmer copy, Inter for Latin and figures,
// Noto Sans Khmer as fallback (and for the legacy dark surfaces).
const kantumruy = Kantumruy_Pro({ subsets: ["khmer", "latin"], variable: "--font-kantumruy", weight: ["400", "500", "600", "700"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoKhmer = Noto_Sans_Khmer({ subsets: ["khmer"], variable: "--font-noto-khmer", weight: ["400", "600", "700"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-loaded" });

export const metadata = { title: "TeleScripts Agent", description: "បង្កើត Telegram Bot ដោយមិនបាច់ចេះសរសេរកូដ" };

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FAF9F6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="km" className={`${kantumruy.variable} ${inter.variable} ${notoKhmer.variable} ${mono.variable}`}>
    <head><link rel="stylesheet" href="/checkout-theme.css" /></head>
    <body><LanguageProvider><AuthGate>{children}</AuthGate></LanguageProvider></body>
  </html>;
}
