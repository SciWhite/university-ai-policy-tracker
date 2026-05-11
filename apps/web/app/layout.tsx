import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeScript } from "@/components/theme-script";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSiteBaseUrl } from "@/lib/site-url";

const primaryTabs = [
  { label: "Overview", href: "/" },
  { label: "Universities", href: "/universities" },
  { label: "Changes", href: "/changes" },
  { label: "Reports", href: "/reports" },
  { label: "Datasets", href: "/datasets" },
  { label: "Methodology", href: "/methodology" },
  { label: "Citation", href: "/citation" }
] as const;

const githubRepositoryUrl = "https://github.com/SciWhite/university-ai-policy-tracker";

export const metadata = {
  metadataBase: new URL(getSiteBaseUrl()),
  title: "University AI Policy Tracker",
  description:
    "Open, evidence-backed database of university AI policies, source snapshots, and citation-ready public JSON."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="/feeds/reports.xml"
          rel="alternate"
          title="University AI Policy Tracker reports RSS"
          type="application/rss+xml"
        />
        <link
          href="/feeds/recent-changes.xml"
          rel="alternate"
          title="University AI Policy Tracker recent changes RSS"
          type="application/rss+xml"
        />
        <link
          href="/feeds/atom.xml"
          rel="alternate"
          title="University AI Policy Tracker Atom feed"
          type="application/atom+xml"
        />
      </head>
      <body>
        <ThemeScript />
        <header className="site-header">
          <div className="site-header__top">
            <div className="site-brand">
              <Link className="brand-link" href="/">
                University AI Policy Tracker
              </Link>
              <p className="site-tagline">
                Open, evidence-backed AI policy records for public reuse.
              </p>
            </div>
            <div className="site-header__actions" aria-label="Primary actions">
              <a className="site-action" href="/api/public/v1/index.json">
                API index
              </a>
              <a className="site-action" href={githubRepositoryUrl}>
                GitHub repo
              </a>
              <ThemeToggle />
            </div>
          </div>
          <nav className="site-nav" aria-label="Database navigation">
            {primaryTabs.map((tab) => (
              <Link href={tab.href} key={tab.href}>
                {tab.label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <div className="site-footer__inner">
            <p>
              Open tracker metadata for citation and analysis. This site is not
              legal advice, academic integrity advice, or an official university
              statement; original source evidence remains canonical.
            </p>
            <nav aria-label="Trust and reference links">
              <Link href="/methodology">Methodology</Link>
              <Link href="/citation">Citation</Link>
              <Link href="/datasets">Datasets</Link>
              <Link href="/changes">Changes</Link>
              <Link href="/reports">Reports</Link>
              <a href="/llms.txt">llms.txt</a>
              <a href="/feeds/reports.xml">Reports RSS</a>
              <a href="/api/public/v1/index.json">Public API index</a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
