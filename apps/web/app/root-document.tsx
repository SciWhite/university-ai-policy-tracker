import type { ReactNode } from "react";
import { SiteShell } from "@/components/site-shell";
import { ThemeScript } from "@/components/theme-script";
import { ClarityIntegration } from "@/components/clarity-integration";
import type { SupportedLocale } from "@/lib/i18n";

interface RootDocumentProps {
  children: ReactNode;
  locale: SupportedLocale;
  enableClarity?: boolean;
}

export function RootDocument({ children, locale, enableClarity = false }: RootDocumentProps) {
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <ThemeScript />
        <link href="/feeds/reports.xml" rel="alternate" title="University AI Policy Tracker reports RSS" type="application/rss+xml" />
        <link href="/feeds/recent-changes.xml" rel="alternate" title="University AI Policy Tracker recent changes RSS" type="application/rss+xml" />
        <link href="/feeds/atom.xml" rel="alternate" title="University AI Policy Tracker Atom feed" type="application/atom+xml" />
      </head>
      <body data-clarity-mask={enableClarity ? "true" : undefined} data-uapt-clarity={enableClarity ? "consent-v1" : undefined}>
        <SiteShell>{children}</SiteShell>
        {enableClarity ? <ClarityIntegration /> : null}
      </body>
    </html>
  );
}
