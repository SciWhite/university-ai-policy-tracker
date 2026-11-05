import type { ReactNode } from "react";
import { SiteShell } from "@/components/site-shell";
import { ThemeScript } from "@/components/theme-script";
import { ClarityIntegration } from "@/components/clarity-integration";
import type { ReadingLocale } from "@/lib/language-catalog";
import { readingDirection } from "@/lib/language-catalog";
import { ReadingUiTextProvider } from "@/components/reading-ui-text-provider";
import { getShellMessages } from "@/lib/i18n-messages";
import { applyAcceptedReadingUiText } from "@/lib/reading-ui-text";
import { isSupportedLocale } from "@/lib/i18n";
import { ReadingCohortBootstrap } from "@/components/reading-cohort-bootstrap";
import { publishedV6Slugs } from "@/lib/policy-v6-published";

interface RootDocumentProps {
  children: ReactNode;
  locale: ReadingLocale;
  enableClarity?: boolean;
  sharedUiText?: Readonly<Record<string, string>>;
}

export function RootDocument({ children, locale, enableClarity = false, sharedUiText = {} }: RootDocumentProps) {
  const sourceShell = getShellMessages(locale);
  const shell = applyAcceptedReadingUiText(sourceShell, sharedUiText);
  const showEnglishFallback = !isSupportedLocale(locale) && hasMissingShellText(sourceShell, sharedUiText);
  return (
    <html lang={locale} dir={readingDirection(locale)} suppressHydrationWarning>
      <head>
        <ThemeScript />
        <link href="/feeds/reports.xml" rel="alternate" title="University AI Policy Tracker reports RSS" type="application/rss+xml" />
        <link href="/feeds/recent-changes.xml" rel="alternate" title="University AI Policy Tracker recent changes RSS" type="application/rss+xml" />
        <link href="/feeds/atom.xml" rel="alternate" title="University AI Policy Tracker Atom feed" type="application/atom+xml" />
      </head>
      <body data-clarity-mask={enableClarity ? "true" : undefined} data-uapt-clarity={enableClarity ? "consent-v1" : undefined}>
        <ReadingCohortBootstrap slugs={publishedV6Slugs()} />
        <ReadingUiTextProvider value={sharedUiText} shell={shell}>
          <SiteShell showEnglishFallback={showEnglishFallback}>{children}</SiteShell>
          {enableClarity ? <ClarityIntegration /> : null}
        </ReadingUiTextProvider>
      </body>
    </html>
  );
}

function hasMissingShellText(value: unknown, translations: Readonly<Record<string, string>>): boolean {
  if (typeof value === "string") return Boolean(value.trim()) && !translations[value];
  if (Array.isArray(value)) return value.some(item => hasMissingShellText(item, translations));
  return Boolean(value && typeof value === "object" && Object.values(value).some(item => hasMissingShellText(item, translations)));
}
