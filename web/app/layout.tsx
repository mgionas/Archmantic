import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import { ClerkProvider, OrganizationSwitcher, UserButton } from "@clerk/nextjs";
// bpmn-js editor styles (palette, context pad, icons) — global CSS, layout-only.
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "Archmantic",
  description: "A living, trustworthy architecture model for humans and AI agents.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={cn("dark", geist.variable)} suppressHydrationWarning>
        <body className="min-h-screen bg-background font-sans text-foreground antialiased">
          <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
              <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
                <span className="inline-block size-2.5 rounded-sm bg-primary" />
                Archmantic
              </Link>
              <div className="flex-1" />
              <OrganizationSwitcher
                hidePersonal={false}
                appearance={{ elements: { rootBox: "flex items-center" } }}
              />
              <UserButton />
            </div>
          </header>
          <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
          <Toaster richColors position="top-center" />
        </body>
      </html>
    </ClerkProvider>
  );
}
