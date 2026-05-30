import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { DocumentLink } from "@/components/document-link";
import { HtmlLangSync } from "@/components/html-lang-sync";
import { LanguageSuggestion } from "@/components/language-suggestion";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SiteNavigation } from "@/components/site-navigation";
import { ThemeScript } from "@/components/theme-script";
import { ThemeToggle } from "@/components/theme-toggle";
import { getShellMessages } from "@/lib/i18n-messages";
import { normalizeLocale, type SupportedLocale } from "@/lib/i18n";
import { getSiteBaseUrl } from "@/lib/site-url";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import frMessages from "@/messages/fr.json";
import msMessages from "@/messages/ms.json";
import nlMessages from "@/messages/nl.json";
import plMessages from "@/messages/pl.json";
import zhMessages from "@/messages/zh.json";

const primaryTabs = [
  { labelKey: "search", href: "/search" },
  { labelKey: "universities", href: "/universities" },
  { labelKey: "analysis", href: "/analysis" },
  { labelKey: "changes", href: "/changes" },
  { labelKey: "datasets", href: "/datasets" },
  { labelKey: "methodology", href: "/methodology" },
  { labelKey: "contribute", href: "/contribute" }
] as const;

const secondaryLinkGroups = [
  {
    labelKey: "dataAndApi",
    links: [
      { labelKey: "datasets", href: "/datasets" },
      { labelKey: "apiDocs", href: "/api-reference" },
      { labelKey: "publicApi", href: "/api/public/v1/index.json" },
      { labelKey: "mcpAlpha", href: "/mcp" },
      { labelKey: "widgets", href: "/widgets" }
    ]
  },
  {
    labelKey: "trustAndCitation",
    links: [
      { labelKey: "methodology", href: "/methodology" },
      { labelKey: "citation", href: "/citation" },
      { labelKey: "aiPolicyDatabase", href: "/university-ai-policy-database" },
      { labelKey: "llms", href: "/llms.txt" }
    ]
  },
  {
    labelKey: "updates",
    links: [
      { labelKey: "changes", href: "/changes" },
      { labelKey: "reports", href: "/reports" },
      { labelKey: "reportsRss", href: "/feeds/reports.xml" },
      { labelKey: "changesRss", href: "/feeds/recent-changes.xml" }
    ]
  },
  {
    labelKey: "coverageAndReview",
    links: [
      { labelKey: "coverage", href: "/coverage" },
      { labelKey: "sourceHealth", href: "/source-health" },
      { labelKey: "reviewWorkflow", href: "/review" },
      { labelKey: "reviewQueue", href: "/review/queue" }
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

const messagesByLocale = {
  en: enMessages,
  zh: zhMessages,
  fr: frMessages,
  pl: plMessages,
  es: esMessages,
  nl: nlMessages,
  ms: msMessages
} as const;

export default async function RootLayout({
  children,
  params
}: {
  children: ReactNode;
  params?: Promise<{ locale?: string }>;
}) {
  const requestHeaders = await headers();
  const locale = normalizeLocale(
    requestHeaders.get("x-uapt-locale") ?? (await params)?.locale
  );
  const shell = getShellMessages(locale);
  const footerLabels = shell.footer as Record<string, string>;
  const navigationLabels = shell.navigation as Record<string, string>;

  return (
    <html lang={locale} suppressHydrationWarning>
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
        <NextIntlClientProvider
          locale={locale}
          messages={messagesByLocale[locale]}
        >
          <HtmlLangSync />
          <header className="site-header">
            <LanguageSuggestion />
            <div className="site-header__top">
              <div className="site-brand">
                <DocumentLink className="brand-link" href="/">
                  University AI Policy Tracker
                </DocumentLink>
                <p className="site-tagline">{shell.tagline}</p>
              </div>
              <div className="site-header__actions" aria-label="Primary actions">
                <DocumentLink className="site-action" href="/api-reference">
                  {shell.actions.api}
                </DocumentLink>
                <a className="site-action" href={githubRepositoryUrl}>
                  {shell.actions.github}
                </a>
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
            </div>
            <SiteNavigation items={primaryTabs} />
          </header>
          {children}
          <footer className="site-footer">
            <div className="site-footer__inner">
              <div className="site-footer__intro">
                <p>{shell.footer.intro}</p>
              </div>
              <nav
                className="site-footer__link-groups"
                aria-label="Secondary links"
              >
                {secondaryLinkGroups.map((group) => (
                  <section className="site-footer__group" key={group.labelKey}>
                    <h2>{shell.footer[group.labelKey]}</h2>
                    <ul>
                      {group.links.map((link) => (
                        <li key={link.href}>
                          <DocumentLink href={link.href}>
                            {footerLabels[link.labelKey] ??
                              navigationLabels[link.labelKey] ??
                              link.labelKey}
                          </DocumentLink>
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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
