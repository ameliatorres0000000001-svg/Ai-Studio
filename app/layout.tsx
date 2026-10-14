import "./globals.css";
import { Inter, JetBrains_Mono, Noto_Sans_Khmer } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n";
import { AuthGate } from "@/components/AuthGate";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const khmer = Noto_Sans_Khmer({ subsets: ["khmer"], variable: "--font-khmer", weight: ["400", "600", "700"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-loaded" });

export const metadata = { title: "CodingStudio", description: "AI Developer Workspace — GitHub-first coding with Coding Agent" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="km" className={`${inter.variable} ${khmer.variable} ${mono.variable}`}>
    <head><link rel="stylesheet" href="/checkout-theme.css" /></head>
    <body><LanguageProvider><AuthGate>{children}</AuthGate></LanguageProvider></body>
  </html>;
}
