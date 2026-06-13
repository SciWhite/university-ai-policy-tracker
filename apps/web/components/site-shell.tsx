"use client";

import { NextIntlClientProvider } from "next-intl";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AnalyticsEventBridge } from "@/components/analytics-event-bridge";
import { DocumentLink } from "@/components/document-link";
import { HtmlLangSync } from "@/components/html-lang-sync";
import { LanguageSuggestion } from "@/components/language-suggestion";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SiteNavigation } from "@/components/site-navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { getLocaleFromPathname } from "@/lib/i18n";
import { getShellMessages } from "@/lib/i18n-messages";
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
  { labelKey: "reports", href: "/reports" },
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

const githubRepositoryUrl =
  "https://github.com/SciWhite/university-ai-policy-tracker";

const messagesByLocale = {
  en: enMessages,
  zh: zhMessages,
  fr: frMessages,
  pl: plMessages,
  es: esMessages,
  nl: nlMessages,
  ms: msMessages
} as const;

interface SiteShellProps {
  children: ReactNode;
  enableInsights: boolean;
}

export function SiteShell({ children, enableInsights }: SiteShellProps) {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const shell = getShellMessages(locale);
  const footerLabels = shell.footer as Record<string, string>;
  const navigationLabels = shell.navigation as Record<string, string>;

  return (
    <NextIntlClientProvider locale={locale} messages={messagesByLocale[locale]}>
      <HtmlLangSync />
      <header className="site-header">
        <LanguageSuggestion />
        <div className="site-header__top">
          <div className="site-brand">
            <DocumentLink
              className="brand-link"
              data-analytics-event="nav_click"
              data-analytics-nav-area="brand"
              href="/"
            >
              University AI Policy Tracker
            </DocumentLink>
          </div>
          <div className="site-header__actions" aria-label="Primary actions">
            <DocumentLink
              className="site-action"
              data-analytics-event="nav_click"
              data-analytics-nav-area="header_action"
              data-analytics-target-kind="api_reference"
              href="/api-reference"
            >
              {shell.actions.api}
            </DocumentLink>
            <a
              className="site-action"
              data-analytics-event="github_click"
              data-analytics-nav-area="header_action"
              href={githubRepositoryUrl}
            >
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
          <nav className="site-footer__link-groups" aria-label="Secondary links">
            {secondaryLinkGroups.map((group) => (
              <section className="site-footer__group" key={group.labelKey}>
                <h2>{shell.footer[group.labelKey]}</h2>
                <ul>
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <DocumentLink
                        data-analytics-event="footer_link_click"
                        data-analytics-footer-group={group.labelKey}
                        href={link.href}
                      >
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
      {enableInsights ? (
        <>
          <AnalyticsEventBridge />
          <Analytics />
          <SpeedInsights />
        </>
      ) : null}
    </NextIntlClientProvider>
  );
}
