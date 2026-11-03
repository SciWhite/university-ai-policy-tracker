"use client";

import type { ReactNode } from "react";
import { AnalyticsEventBridge } from "@/components/analytics-event-bridge";
import { DocumentLink } from "@/components/document-link";
import { LanguageSuggestion } from "@/components/language-suggestion";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SiteNavigation } from "@/components/site-navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { useShellMessages } from "@/components/reading-ui-text-provider";

const primaryNavigation = [
  { labelKey: "search", href: "/search" },
  { labelKey: "universities", href: "/universities" },
  {
    labelKey: "explore",
    links: [
      { labelKey: "aiTools", href: "/tools" },
      { labelKey: "sources", href: "/sources" },
      { labelKey: "themeAiDisclosure", href: "/themes/ai-disclosure" },
      { labelKey: "regionUnitedStates", href: "/regions/united-states" },
      { labelKey: "regionUnitedKingdom", href: "/regions/united-kingdom" },
      { labelKey: "rankingQs2026", href: "/rankings/qs-2026" }
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
    labelKey: "researchData",
    links: [
      { labelKey: "analysis", href: "/analysis" },
      { labelKey: "datasets", href: "/datasets" },
      { labelKey: "apiDocs", href: "/api-reference" },
      { labelKey: "publicApi", href: "/api/public/v1/index.json" },
      { labelKey: "methodology", href: "/methodology" },
      { labelKey: "about", href: "/about" },
      { labelKey: "citation", href: "/citation" },
      { labelKey: "coverage", href: "/coverage" },
      { labelKey: "sourceHealth", href: "/source-health" },
      { labelKey: "reviewWorkflow", href: "/review" },
      { labelKey: "reviewQueue", href: "/review/queue" }
    ]
  },
  { labelKey: "contribute", href: "/contribute" }
] as const;

const secondaryLinkGroups = [
  { labelKey: "supportAndPrivacy", links: [
    { labelKey: "contact", href: "/contact" }, { labelKey: "support", href: "/support" },
    { labelKey: "privacy", href: "/privacy" }, { labelKey: "terms", href: "/terms" }
  ] },
  {
    labelKey: "browse",
    links: [
      { labelKey: "aiTools", href: "/tools" },
      { labelKey: "sources", href: "/sources" },
      { labelKey: "themeAiDisclosure", href: "/themes/ai-disclosure" },
      { labelKey: "regionUnitedStates", href: "/regions/united-states" },
      { labelKey: "regionUnitedKingdom", href: "/regions/united-kingdom" },
      { labelKey: "rankingQs2026", href: "/rankings/qs-2026" }
    ]
  },
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

interface SiteShellProps {
  children: ReactNode;
  showEnglishFallback?: boolean;
}

export function SiteShell({ children, showEnglishFallback = false }: SiteShellProps) {
  const shell = useShellMessages();
  const footerLabels = shell.footer as Record<string, string>;
  const navigationLabels = shell.navigation as Record<string, string>;

  return (
    <>
      <a className="skip-link" href="#main-content">
        {shell.skipToContent}
      </a>
      <header className="site-header">
        {showEnglishFallback ? <p className="notice-card" lang="en">Some site controls are shown in English when a reviewed translation is unavailable.</p> : null}
        <LanguageSuggestion />
        <div className="site-header__top">
          <div className="site-brand">
            <DocumentLink
              className="brand-link"
              data-analytics-event="nav_click"
              data-analytics-nav-area="brand"
              href="/"
            >
              <img
                className="site-brand-icon"
                src="/assets/brand/uapt-icon-32.png"
                srcSet="/assets/brand/uapt-icon-32.png 1x, /assets/brand/uapt-icon-64.png 2x"
                width="32"
                height="32"
                alt=""
                decoding="async"
              />
              <span>University AI Policy Tracker</span>
            </DocumentLink>
          </div>
          <div className="site-header__actions" aria-label={shell.actions.label}>
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
        <SiteNavigation
          items={primaryNavigation}
          mobileUtilities={
            <>
              <DocumentLink
                className="site-action"
                data-analytics-event="nav_click"
                data-analytics-nav-area="mobile_menu"
                data-analytics-target-kind="api_reference"
                href="/api-reference"
              >
                {shell.actions.api}
              </DocumentLink>
              <a
                className="site-action"
                data-analytics-event="github_click"
                data-analytics-nav-area="mobile_menu"
                href={githubRepositoryUrl}
              >
                {shell.actions.github}
              </a>
              <ThemeToggle />
            </>
          }
        />
      </header>
      <div id="main-content" tabIndex={-1}>
        {children}
      </div>
      <footer className="site-footer">
        <div className="site-footer__inner">
          <nav className="site-footer__link-groups" aria-label={shell.footer.secondaryLinks}>
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
      <AnalyticsEventBridge />
    </>
  );
}
