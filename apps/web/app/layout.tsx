import "./globals.css";
import type { ReactNode } from "react";
import { SiteShell } from "@/components/site-shell";
import { ThemeScript } from "@/components/theme-script";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getSiteBaseUrl } from "@/lib/site-url";

const isVercelDeployment = process.env.VERCEL === "1";

export const metadata = {
  metadataBase: new URL(getSiteBaseUrl()),
  title: "University AI Policy Tracker",
  description:
    "Open, evidence-backed database of university AI policies, source snapshots, and citation-ready public JSON."
};

export default async function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
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
        <SiteShell enableInsights={isVercelDeployment}>{children}</SiteShell>
      </body>
    </html>
  );
}
