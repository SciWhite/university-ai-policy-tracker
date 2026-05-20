import "./globals.css";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { ReactNode } from "react";
import { SiteNavigation } from "@/components/site-navigation";
import { ThemeScript } from "@/components/theme-script";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSiteBaseUrl } from "@/lib/site-url";

const primaryTabs = [
  { label: "Search", href: "/search" },
  { label: "Universities", href: "/universities" },
  { label: "Analysis", href: "/analysis" },
  { label: "Changes", href: "/changes" },
  { label: "Datasets", href: "/datasets" },
  { label: "Methodology", href: "/methodology" },
  { label: "Contribute", href: "/contribute" }
] as const;

const secondaryLinkGroups = [
  {
    label: "Data and API",
    links: [
      { label: "Datasets", href: "/datasets" },
      { label: "API docs", href: "/api-reference" },
      { label: "Public API", href: "/api/public/v1/index.json" },
      { label: "MCP alpha", href: "/mcp" },
      { label: "Widgets", href: "/widgets" }
    ]
  },
  {
    label: "Trust and citation",
    links: [
      { label: "Methodology", href: "/methodology" },
      { label: "Citation", href: "/citation" },
      { label: "AI Policy Database", href: "/university-ai-policy-database" },
      { label: "llms.txt", href: "/llms.txt" }
    ]
  },
  {
    label: "Updates",
    links: [
      { label: "Changes", href: "/changes" },
      { label: "Reports", href: "/reports" },
      { label: "Reports RSS", href: "/feeds/reports.xml" },
      { label: "Changes RSS", href: "/feeds/recent-changes.xml" }
    ]
  },
  {
    label: "Coverage and review",
    links: [
      { label: "Coverage", href: "/coverage" },
      { label: "Source health", href: "/source-health" },
      { label: "Review workflow", href: "/review" },
      { label: "Review queue", href: "/review/queue" }
    ]
  }
] as const;

const githubRepositoryUrl = "https://github.com/SciWhite/university-ai-policy-tracker";
const isVercelDeployment = process.env.VERCEL === "1";

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
              <Link className="site-action" href="/api-reference">
                API
              </Link>
              <a className="site-action" href={githubRepositoryUrl}>
                GitHub
              </a>
              <ThemeToggle />
            </div>
          </div>
          <SiteNavigation items={primaryTabs} />
        </header>
        {children}
        <footer className="site-footer">
          <div className="site-footer__inner">
            <div className="site-footer__intro">
              <p>
                Open tracker metadata for citation and analysis. Not legal
                advice, academic integrity advice, or an official university
                statement.
              </p>
            </div>
            <nav className="site-footer__link-groups" aria-label="Secondary links">
              {secondaryLinkGroups.map((group) => (
                <section className="site-footer__group" key={group.label}>
                  <h2>{group.label}</h2>
                  <ul>
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <FooterLink href={link.href}>{link.label}</FooterLink>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </nav>
          </div>
        </footer>
        {isVercelDeployment ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}
      </body>
    </html>
  );
}

function FooterLink({
  children,
  href
}: {
  children: ReactNode;
  href: string;
}) {
  if (isDocumentLink(href)) {
    return <a href={href}>{children}</a>;
  }

  return <Link href={href}>{children}</Link>;
}

function isDocumentLink(href: string): boolean {
  return (
    href.startsWith("http") ||
    href.startsWith("/api/") ||
    href.startsWith("/feeds/") ||
    href.endsWith(".txt") ||
    href.endsWith(".json")
  );
}
