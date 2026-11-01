import type { ReactNode } from "react";
import { SiteShell } from "@/components/site-shell";
import { ThemeScript } from "@/components/theme-script";
import { ClarityIntegration } from "@/components/clarity-integration";
import type { ReadingLocale } from "@/lib/language-catalog";
import { readingDirection } from "@/lib/language-catalog";
import { ReadingUiTextProvider } from "@/components/reading-ui-text-provider";

interface RootDocumentProps {
  children: ReactNode;
  locale: ReadingLocale;
  enableClarity?: boolean;
  sharedUiText?: Readonly<Record<string, string>>;
}

export function RootDocument({ children, locale, enableClarity = false, sharedUiText = {} }: RootDocumentProps) {
  return (
    <html lang={locale} dir={readingDirection(locale)} suppressHydrationWarning>
      <head>
        <ThemeScript />
        <link href="/feeds/reports.xml" rel="alternate" title="University AI Policy Tracker reports RSS" type="application/rss+xml" />
        <link href="/feeds/recent-changes.xml" rel="alternate" title="University AI Policy Tracker recent changes RSS" type="application/rss+xml" />
        <link href="/feeds/atom.xml" rel="alternate" title="University AI Policy Tracker Atom feed" type="application/atom+xml" />
      </head>
      <body data-clarity-mask={enableClarity ? "true" : undefined} data-uapt-clarity={enableClarity ? "consent-v1" : undefined}>
        <ReadingUiTextProvider value={sharedUiText}>
          <SiteShell>{children}</SiteShell>
          {enableClarity ? <ClarityIntegration /> : null}
        </ReadingUiTextProvider>
      </body>
    </html>
  );
}
