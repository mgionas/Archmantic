import "./globals.css";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import { MarketingShell } from "@/components/marketing-shell";

// Refined modern dev-tool type system (Vercel/Next/Laravel): Geist Sans is the voice;
// Geist Mono only for code/data. Clean, high-contrast, not mono-everywhere.
const geistSans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata = {
  title: "Archmantic — architecture your team and agents trust",
  description:
    "Archmantic reverse-engineers a living, grounded model of your codebase — capability map, diagrams, data model, API surface — that your team reads as docs and your AI agents query over MCP. Every element traced to a line of code.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth().catch(() => ({ userId: null }));
  return (
    <ClerkProvider>
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
        <body className="min-h-screen bg-background font-sans text-foreground antialiased">
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
            {userId ? <AppShell>{children}</AppShell> : <MarketingShell>{children}</MarketingShell>}
            <Toaster richColors position="top-center" />
          </ThemeProvider>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
