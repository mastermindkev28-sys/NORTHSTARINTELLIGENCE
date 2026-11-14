import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { Wordmark } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Northstar Intelligence",
  description: "The intelligence infrastructure for real estate.",
};

const NAV: { group: string; items: { href: string; label: string }[] }[] = [
  { group: "Command", items: [{ href: "/", label: "Executive" }] },
  { group: "Acquire", items: [{ href: "/leads", label: "Lead Intelligence" }] },
  { group: "Underwrite", items: [{ href: "/underwrite", label: "Deal Analyzer" }] },
  {
    group: "Platform",
    items: [
      { href: "/automation", label: "Automation Center" },
      { href: "/agents", label: "Agents" },
    ],
  },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <aside className="hidden w-60 shrink-0 border-r border-line bg-obsidian px-4 py-5 md:block">
            <Link href="/" aria-label="Northstar Intelligence home">
              <Wordmark />
            </Link>
            <nav className="mt-8 space-y-6" aria-label="Primary">
              {NAV.map((g) => (
                <div key={g.group}>
                  <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/80">
                    {g.group}
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {g.items.map((i) => (
                      <li key={i.href}>
                        <Link
                          href={i.href}
                          className="block rounded-md px-2 py-1.5 text-sm text-titanium/90 transition-colors hover:bg-graphite hover:text-arctic"
                        >
                          {i.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="mt-10 rounded-md border border-caution/30 bg-caution/5 p-3 text-[11px] leading-relaxed text-caution/90">
              Demo workspace. All people, properties, and market data are synthetic. Messages go to
              a sandbox, never to real phones.
            </div>
          </aside>
          <div className="min-w-0 flex-1">
            <header className="flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
              <Wordmark />
            </header>
            <main className="fade-in mx-auto max-w-7xl px-4 py-6 md:px-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
