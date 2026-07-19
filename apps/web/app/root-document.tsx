import type { ReactNode } from "react";
import { SiteShell } from "@/components/site-shell";
import { ThemeScript } from "@/components/theme-script";
import type { SupportedLocale } from "@/lib/i18n";

interface RootDocumentProps {
  children: ReactNode;
  locale: SupportedLocale;
}

export function RootDocument({ children, locale }: RootDocumentProps) {
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link href="/feeds/reports.xml" rel="alternate" title="University AI Policy Tracker reports RSS" type="application/rss+xml" />
        <link href="/feeds/recent-changes.xml" rel="alternate" title="University AI Policy Tracker recent changes RSS" type="application/rss+xml" />
        <link href="/feeds/atom.xml" rel="alternate" title="University AI Policy Tracker Atom feed" type="application/atom+xml" />
      </head>
      <body>
        <ThemeScript />
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
