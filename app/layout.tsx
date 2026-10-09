import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { AuthGate } from "@/components/AuthGate";

export const metadata = {
  title: "CodingStudio",
  description: "AI Developer Workspace — GitHub-first coding with Coding Agent",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="km">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Battambang:wght@400;700&family=Noto+Sans+Khmer:wght@400;600&display=swap"
        />
        <link rel="stylesheet" href="/checkout-theme.css" />
      </head>
      <body>
        <LanguageProvider>
          <AuthGate>{children}</AuthGate>
        </LanguageProvider>
      </body>
    </html>
  );
}
