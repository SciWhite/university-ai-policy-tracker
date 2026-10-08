import { getProjectCopy } from "@/lib/project-copy";
import { organizationIdentity } from "@/lib/organization-identity";
import React from "react";
import { PUBLIC_API_VERSION } from "@uapt/shared";
import { DocumentLink as Link } from "@/components/document-link";
import { JsonLd } from "@/components/json-ld";
import { SearchAutocomplete } from "@/components/search-autocomplete";
import { StateLabel } from "@/components/state-label";
import { getHomeV4Copy, type HomeV4Topic } from "@/lib/home-v4-copy";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";
import { localizeHref, type SupportedLocale } from "@/lib/i18n";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import type { StaticUniversityIndexRecord } from "@/lib/university-index-records";

interface HomeV4ViewProps {
  locale: SupportedLocale;
  universities: StaticUniversityIndexRecord[];
  claimCount: number;
  sourceCount: number;
  recentRecords: StaticUniversityIndexRecord[];
  eligibleGuideSlugs?: string[];
  isPreview?: boolean;
}

const countryNameToCode: Record<string, string> = {
  "United States": "US",
  "United States of America": "US",
  "USA": "US",
  "United Kingdom": "GB",
  "UK": "GB",
  "Singapore": "SG",
  "Australia": "AU",
  "Canada": "CA",
  "Netherlands": "NL",
  "South Africa": "ZA",
  "New Zealand": "NZ",
  "Sweden": "SE",
  "Philippines": "PH",
  "Germany": "DE",
  "France": "FR",
  "Switzerland": "CH",
  "Japan": "JP",
  "China": "CN",
  "Hong Kong": "HK",
  "Chile": "CL"
};

function formatCountryName(countryName: string, locale: string): string {
  if (!countryName) return "";
  const code = countryNameToCode[countryName];
  if (code) {
    try {
      const dn = new Intl.DisplayNames([locale], { type: "region" });
      return dn.of(code) ?? countryName;
    } catch {
      return countryName;
    }
  }
  return countryName;
}

export function HomeV4View({
  locale,
  universities,
  claimCount,
  sourceCount,
  recentRecords,
  eligibleGuideSlugs,
  isPreview = false
}: HomeV4ViewProps) {
  const copy = getHomeV4Copy(locale);
  const universitiesJsonPath = `/api/public/${PUBLIC_API_VERSION}/universities.json`;
  const formattedUniCount = new Intl.NumberFormat(locale).format(universities.length);
  const formattedClaimCount = new Intl.NumberFormat(locale).format(claimCount);

  const eligibleSet = new Set(eligibleGuideSlugs ?? []);
  const guides = copy.guides.filter((g) => eligibleSet.has(g.slug));
  const guideHref = (slug: string) =>
    isPreview ? `/universities/${slug}?layout=reference-v4` : `/universities/${slug}`;

  return (
    <div className="home-v4" data-i18n="preserve">
      <p className="compact-note">{getProjectCopy(locale).lead} <Link href="/about" localeOverride={locale}>{getProjectCopy(locale).title}</Link></p>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            organizationIdentity,
            {
              "@id": getAbsoluteSiteUrl(localizeHref("/#website", locale)),
              "@type": "WebSite",
              description: copy.heroSubtitle,
              name: copy.metaTitle,
              potentialAction: {
                "@type": "SearchAction",
                "query-input": "required name=search_term_string",
                target: getAbsoluteSiteUrl(
                  localizeHref("/search?q={search_term_string}", locale)
                )
              },
              publisher: {
                "@id": getAbsoluteSiteUrl("/#organization")
              },
              url: getAbsoluteSiteUrl(localizeHref("/", locale))
            },
            {
              "@id": getAbsoluteSiteUrl(localizeHref("/#faq", locale)),
              "@type": "FAQPage",
              mainEntity: copy.faqItems.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: item.answer
                }
              }))
            },
            {
              "@id": getAbsoluteSiteUrl("/#dataset"),
              "@type": "Dataset",
              creator: {
                "@id": getAbsoluteSiteUrl("/#organization")
              },
              description:
                "Source-backed university AI policy metadata with public JSON, review states, original-language evidence snippets, and citation fields.",
              distribution: [
                {
                  "@type": "DataDownload",
                  contentUrl: getAbsoluteSiteUrl(universitiesJsonPath),
                  encodingFormat: "application/json",
                  name: "Public university records JSON"
                },
                {
                  "@type": "DataDownload",
                  contentUrl: getAbsoluteSiteUrl(
                    `/api/public/${PUBLIC_API_VERSION}/datasets/latest.json`
                  ),
                  encodingFormat: "application/json",
                  name: "Dataset release manifest"
                }
              ],
              isAccessibleForFree: true,
              license: "https://creativecommons.org/licenses/by/4.0/",
              name: "University AI Policy Tracker public dataset",
              publisher: {
                "@id": getAbsoluteSiteUrl("/#organization")
              },
              url: getAbsoluteSiteUrl("/datasets")
            }
          ]
        }}
      />

      {/* 1. Hero & Core Search Section */}
      <section className="home-v4__hero" aria-labelledby="home-v4-title">
        <div className="home-v4__hero-content">
          <h1 id="home-v4-title" className="home-v4__title">
            {copy.heroHeading}
          </h1>
          <p className="home-v4__subtitle">{copy.heroSubtitle}</p>

          <form
            action={localizeHref("/search", locale)}
            className="home-v4__search-form"
            method="get"
            role="search"
          >
            <label htmlFor="home-v4-search-input" className="home-v4__search-label">
              {copy.searchLabel}
            </label>
            <div className="home-v4__search-bar">
              <SearchAutocomplete
                id="home-v4-search-input"
                name="q"
                placeholder={copy.searchPlaceholder}
                preserveQueryOnEscape
              />
              <button type="submit" className="home-v4__search-button">
                {copy.searchButton}
              </button>
            </div>
          </form>

          <nav className="home-v4__examples" aria-label={copy.examplesPrefix}>
            <span className="home-v4__examples-label">{copy.examplesPrefix}</span>
            <div className="home-v4__examples-links">
              {eligibleSet.has("stanford-university") && (
                <Link href={guideHref("stanford-university")} localeOverride={locale}>Stanford</Link>
              )}
              {eligibleSet.has("university-of-bristol") && (
                <Link href={guideHref("university-of-bristol")} localeOverride={locale}>Bristol</Link>
              )}
              {eligibleSet.has("national-university-of-singapore") && (
                <Link href={guideHref("national-university-of-singapore")} localeOverride={locale}>NUS</Link>
              )}
              <Link href="/universities" className="home-v4__examples-browse" localeOverride={locale}>
                {copy.browseAllUniversities}
              </Link>
            </div>
          </nav>

          <p className="home-v4__coverage">
            <span>{copy.coverageNote(formattedUniCount, formattedClaimCount)}</span>
            {" · "}
            <Link href="/coverage" localeOverride={locale}>{copy.viewCoverage}</Link>
          </p>
        </div>

        <div className="home-v4__hero-art" aria-hidden="true">
          <div className="home-v4__art-frame">
            <img
              src="/assets/home-v4/library-study-v1.webp"
              alt={copy.heroArtAlt}
              width={360}
              height={240}
              className="home-v4__art-img"
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* 2. Six Question-Topic Links */}
      <section className="home-v4__section home-v4__topics" aria-labelledby="home-v4-topics-title">
        <div className="home-v4__section-header">
          <h2 id="home-v4-topics-title" className="home-v4__section-title">
            {copy.topicsHeading}
          </h2>
          <p className="home-v4__section-intro">{copy.topicsIntro}</p>
        </div>
        <div className="home-v4__topics-grid">
          {copy.topics.map((topic) => (
            <article key={topic.id} className="home-v4__topic-item">
              <div className="home-v4__topic-icon" aria-hidden="true">
                <TopicIcon type={topic.icon} />
              </div>
              <div className="home-v4__topic-text">
                <h3 className="home-v4__topic-title">
                  <Link href={topic.href} localeOverride={locale}>{topic.title}</Link>
                </h3>
                <p className="home-v4__topic-summary">{topic.summary}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 3. University Guide Examples (Stanford, Bristol, NUS) */}
      <section className="home-v4__section home-v4__guides" aria-labelledby="home-v4-guides-title">
        <div className="home-v4__section-header">
          <h2 id="home-v4-guides-title" className="home-v4__section-title">
            {copy.guidesHeading}
          </h2>
          <p className="home-v4__section-intro">{copy.guidesIntro}</p>
        </div>
        <div className="home-v4__guides-grid">
          {guides.map((guide) => (
            <article key={guide.slug} className="home-v4__guide-card">
              <div className="home-v4__guide-thumb-wrap">
                <img
                  src={guide.thumbSrc}
                  alt={guide.thumbAlt}
                  width={240}
                  height={160}
                  className="home-v4__guide-thumb"
                  loading="lazy"
                />
              </div>
              <div className="home-v4__guide-body">
                <h3 className="home-v4__guide-name">
                  <Link href={guideHref(guide.slug)} localeOverride={locale}>
                    {getLocalizedInstitutionName(guide.slug, guide.name, locale)}
                  </Link>
                </h3>
                <p className="home-v4__guide-status">{guide.status}</p>
                <p className="home-v4__guide-scope">
                  {guide.scopeNote}
                </p>
                <div className="home-v4__guide-cta">
                  <Link href={guideHref(guide.slug)} className="home-v4__guide-link" localeOverride={locale}>
                    {guide.cta} →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 4. Two-Column Layout: Recent Checks (2/3) + Regions & Tools (1/3) */}
      <div className="home-v4__split-row">
        <section
          className="home-v4__split-main home-v4__recent-checks"
          aria-labelledby="home-v4-recent-title"
        >
          <div className="home-v4__section-header">
            <h2 id="home-v4-recent-title" className="home-v4__section-title">
              {copy.recentChecksHeading}
            </h2>
            <p className="home-v4__section-intro">{copy.recentChecksSubtitle}</p>
            <div className="home-v4__changes-link">
              <Link href="/changes" localeOverride={locale}>{copy.viewChangesLog}</Link>
            </div>
          </div>
          <ul className="home-v4__checks-list">
            {recentRecords.map((record) => (
              <li key={record.slug} className="home-v4__check-row">
                <div className="home-v4__check-primary">
                  <Link
                    href={`/universities/${record.slug}`}
                    className="home-v4__check-name"
                    localeOverride={locale}
                  >
                    {getLocalizedInstitutionName(record.slug, record.name, locale)}
                  </Link>
                  <span className="home-v4__check-region">
                    {formatCountryName(record.country || record.region || "", locale)}
                  </span>
                </div>
                <div className="home-v4__check-meta">
                  {record.reviewState ? (
                    <StateLabel reviewState={record.reviewState} locale={locale} />
                  ) : null}
                  <span className="home-v4__check-claims">
                    {record.claimCount} {copy.claimsCountSuffix}
                  </span>
                  <time
                    dateTime={record.lastCheckedAt ?? undefined}
                    className="home-v4__check-date"
                  >
                    {record.lastCheckedAt
                      ? `${copy.checkedDatePrefix} ${formatDate(record.lastCheckedAt, locale)}`
                      : copy.noDate}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside
          className="home-v4__split-side home-v4__regions-tools"
          aria-labelledby="home-v4-side-title"
        >
          <h2 id="home-v4-side-title" className="home-v4__side-title">
            {copy.regionsAndToolsHeading}
          </h2>
          <p className="home-v4__side-intro">{copy.regionsAndToolsSubtitle}</p>

          <div className="home-v4__side-group">
            <h3 className="home-v4__side-subtitle">{copy.regionsGroupTitle}</h3>
            <ul className="home-v4__side-list">
              <li>
                <Link href="/regions/united-states" localeOverride={locale}>{copy.unitedStatesLabel}</Link>
              </li>
              <li>
                <Link href="/regions/united-kingdom" localeOverride={locale}>{copy.unitedKingdomLabel}</Link>
              </li>
              <li className="home-v4__side-more">
                <Link href="/regions" localeOverride={locale}>{copy.allRegionsDirectory}</Link>
              </li>
            </ul>
          </div>

          <div className="home-v4__side-group">
            <h3 className="home-v4__side-subtitle">{copy.toolsGroupTitle}</h3>
            <p className="home-v4__side-text">
              <Link href="/tools" localeOverride={locale}>{copy.aiToolsDirectory}</Link>
            </p>
          </div>

          <div className="home-v4__side-group home-v4__side-group--secondary">
            <h3 className="home-v4__side-subtitle">{copy.institutionalDirectoriesTitle}</h3>
            <p className="home-v4__side-text">
              <Link href="/rankings" localeOverride={locale}>{copy.rankingsDirectory}</Link>
            </p>
            <span className="home-v4__rankings-note">{copy.rankingsNote}</span>
          </div>
        </aside>
      </div>

      {/* 5. Sources, Methodology, Open Data & Visible FAQ */}
      <section
        className="home-v4__section home-v4__opendata"
        aria-labelledby="home-v4-data-title"
      >
        <div className="home-v4__section-header">
          <h2 id="home-v4-data-title" className="home-v4__section-title">
            {copy.openDataHeading}
          </h2>
        </div>

        <div className="home-v4__pillars">
          <article className="home-v4__pillar">
            <h3 className="home-v4__pillar-title">{copy.sourcesPillarTitle}</h3>
            <p className="home-v4__pillar-text">{copy.sourcesPillarText}</p>
            <div className="home-v4__pillar-links">
              <Link href="/sources" localeOverride={locale}>{copy.sourcesLink}</Link>
              {" · "}
              <Link href="/methodology" localeOverride={locale}>{copy.methodologyLink}</Link>
            </div>
          </article>

          <article className="home-v4__pillar">
            <h3 className="home-v4__pillar-title">{copy.citationPillarTitle}</h3>
            <p className="home-v4__pillar-text">{copy.citationPillarText}</p>
            <div className="home-v4__pillar-links">
              <Link href="/citation" localeOverride={locale}>{copy.citationLink}</Link>
            </div>
          </article>

          <article className="home-v4__pillar">
            <h3 className="home-v4__pillar-title">{copy.developerPillarTitle}</h3>
            <p className="home-v4__pillar-text">{copy.developerPillarText}</p>
            <p className="home-v4__rights-note">{copy.rightsNote}</p>
            <div className="home-v4__pillar-links">
              <Link href="/datasets" localeOverride={locale}>{copy.datasetsLink}</Link>
              {" · "}
              <Link href="/api-reference" localeOverride={locale}>{copy.apiLink}</Link>
              {" · "}
              <Link href="/mcp" localeOverride={locale}>{copy.mcpLink}</Link>
            </div>
          </article>
        </div>

        {/* Visible FAQ Section matching FAQPage JSON-LD */}
        <div className="home-v4__faq" aria-labelledby="home-v4-faq-title">
          <h3 id="home-v4-faq-title" className="home-v4__faq-heading">
            {copy.faqHeading}
          </h3>
          <div className="home-v4__faq-list">
            {copy.faqItems.map((item, idx) => (
              <div key={idx} className="home-v4__faq-item">
                <h4 className="home-v4__faq-q">{item.question}</h4>
                <p className="home-v4__faq-a">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function formatDate(value: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function TopicIcon({ type }: { type: HomeV4Topic["icon"] }) {
  switch (type) {
    case "coursework":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case "disclosure":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <line x1="9" y1="10" x2="15" y2="10" />
        </svg>
      );
    case "exams":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "approvedTools":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case "privacyData":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case "detectors":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <path d="M11 8v6" />
          <path d="M8 11h6" />
        </svg>
      );
  }
}
