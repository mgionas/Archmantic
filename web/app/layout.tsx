import "./globals.css";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import { MarketingShell } from "@/components/marketing-shell";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "Archmantic",
  description: "A living, trustworthy architecture model for humans and AI agents.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth().catch(() => ({ userId: null }));
  return (
    <ClerkProvider>
      <html lang="en" className={geist.variable} suppressHydrationWarning>
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
