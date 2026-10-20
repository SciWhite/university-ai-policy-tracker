import { PUBLIC_API_VERSION } from "@uapt/shared";
import { DocumentLink as Link } from "./document-link";
import { JsonLd } from "./json-ld";
import { SearchAutocomplete } from "./search-autocomplete";
import { UniversityMark } from "./university-mark";
import { DiscoveryIcon } from "./discovery-ui";
import { organizationIdentity } from "@/lib/organization-identity";
import { getHomeV4Copy } from "@/lib/home-v4-copy";
import { discoveryCopy } from "@/lib/discovery-copy";
import { mockupCopy } from "@/lib/mockup-copy";
import { localizeHref, type SupportedLocale } from "@/lib/i18n";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import type { StaticUniversityIndexRecord } from "@/lib/university-index-records";
import type { ChangeIndexRecord } from "@/lib/change-records";
interface HomeV6Props {
  locale: SupportedLocale;
  universities: StaticUniversityIndexRecord[];
  claimCount: number;
  sourceCount: number;
  recentRecords: StaticUniversityIndexRecord[];
  recentChanges?: ChangeIndexRecord[];
  eligibleGuideSlugs?: string[];
  isPreview?: boolean;
}
export function HomeV6View({
  locale,
  universities,
  recentChanges = [],
}: HomeV6Props) {
  const copy = getHomeV4Copy(locale),
    ui = discoveryCopy(locale),
    design = mockupCopy(locale);
  const universitiesJsonPath = `/api/public/${PUBLIC_API_VERSION}/universities.json`;
  const examples = [
    ["harvard-university", "Harvard"],
    ["massachusetts-institute-of-technology", "MIT"],
    ["national-university-of-singapore", "NUS"],
  ];
  const guides = [
    "harvard-university",
    "imperial-college-london",
    "national-university-of-singapore",
  ].flatMap((slug) => {
    const record = universities.find((r) => r.slug === slug);
    return record ? [record] : [];
  });
  const topics = [
    {
      id: "coursework",
      title: design.coursework,
      question: design.courseworkQuestion,
      href: "/themes/chatgpt-coursework-policy",
      icon: "document",
    },
    {
      id: "disclosure",
      title: design.disclosure,
      question: design.disclosureQuestion,
      href: "/themes/ai-disclosure",
      icon: "document",
    },
    {
      id: "data",
      title: design.data_safety,
      question: design.dataQuestion,
      href: "/themes/privacy-data-entry",
      icon: "shield",
    },
    {
      id: "tools",
      title: design.tools,
      question: design.toolsQuestion,
      href: "/tools",
      icon: "laptop",
    },
  ] as const;
  return (
    <div className="home-v6 home-v6--mockup" data-i18n="preserve">
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
                  localizeHref("/search?q={search_term_string}", locale),
                ),
              },
              publisher: {
                "@id": getAbsoluteSiteUrl("/#organization"),
              },
              url: getAbsoluteSiteUrl(localizeHref("/", locale)),
            },
            {
              "@id": getAbsoluteSiteUrl(localizeHref("/#faq", locale)),
              "@type": "FAQPage",
              mainEntity: copy.faqItems.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: item.answer,
                },
              })),
            },
            {
              "@id": getAbsoluteSiteUrl("/#dataset"),
              "@type": "Dataset",
              creator: {
                "@id": getAbsoluteSiteUrl("/#organization"),
              },
              description:
                "Source-backed university AI policy metadata with public JSON, review states, original-language evidence snippets, and citation fields.",
              distribution: [
                {
                  "@type": "DataDownload",
                  contentUrl: getAbsoluteSiteUrl(universitiesJsonPath),
                  encodingFormat: "application/json",
                  name: "Public university records JSON",
                },
                {
                  "@type": "DataDownload",
                  contentUrl: getAbsoluteSiteUrl(
                    `/api/public/${PUBLIC_API_VERSION}/datasets/latest.json`,
                  ),
                  encodingFormat: "application/json",
                  name: "Dataset release manifest",
                },
              ],
              isAccessibleForFree: true,
              license: "https://creativecommons.org/licenses/by/4.0/",
              name: "University AI Policy Tracker public dataset",
              publisher: {
                "@id": getAbsoluteSiteUrl("/#organization"),
              },
              url: getAbsoluteSiteUrl("/datasets"),
            },
          ],
        }}
      />

      <section className="home-v6-hero" aria-labelledby="home-v6-title">
        <p className="mockup-eyebrow">University AI Policy Tracker</p>
        <h1 id="home-v6-title">{copy.heroHeading}</h1>
        <p className="home-v6-lead">{design.homeLead}</p>
        <form
          action={localizeHref("/search", locale)}
          method="get"
          role="search"
          className="discovery-search-form home-v6-search"
        >
          <div className="discovery-search-field">
            <DiscoveryIcon name="search" />
            <label className="visually-hidden" htmlFor="home-v6-search">
              {copy.searchLabel}
            </label>
            <SearchAutocomplete
              id="home-v6-search"
              name="q"
              placeholder={design.homePlaceholder}
              preserveQueryOnEscape
              focusOnly
            />
          </div>
          <button type="submit">{ui.search}</button>
        </form>
        <nav className="home-v6-quick" aria-label={copy.examplesPrefix}>
          <span>{copy.examplesPrefix}</span>
          {examples.map(([slug, label]) => (
            <Link
              key={slug}
              href={`/universities/${slug}`}
              localeOverride={locale}
            >
              {label}
            </Link>
          ))}
          <Link href="/universities" localeOverride={locale}>
            {copy.browseAllUniversities}
          </Link>
        </nav>
        <p className="home-v6-independent">{design.independent}</p>
      </section>
      <section className="home-v6-section" aria-labelledby="home-v6-topics">
        <div className="home-v6-section-heading">
          <h2 id="home-v6-topics">{design.check}</h2>
        </div>
        <div className="home-v6-topics">
          {topics.map((topic) => (
            <Link
              className="home-v6-topic"
              key={topic.id}
              href={topic.href}
              localeOverride={locale}
            >
              <DiscoveryIcon name={topic.icon} />
              <div>
                <h3>{topic.title}</h3>
                <p>{topic.question}</p>
              </div>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="home-v6-section" aria-labelledby="home-v6-guides">
        <div className="home-v6-section-heading">
          <h2 id="home-v6-guides">{design.guides}</h2>
          <Link href="/universities" localeOverride={locale}>
            {copy.browseAllUniversities}
          </Link>
        </div>
        <div className="home-v6-guides">
          {guides.map((record) => (
            <article className="home-v6-guide" key={record.slug}>
              <div className="home-v6-guide-heading">
                <UniversityMark slug={record.slug} />
                <div>
                  <h3>
                    <Link
                      href={`/universities/${record.slug}`}
                      localeOverride={locale}
                    >
                      {record.name}
                    </Link>
                  </h3>
                  <p className="discovery-location">
                    {[record.region, record.country].filter(Boolean).join(", ")}
                  </p>
                </div>
              </div>
              <p>{design.guideLead}</p>
              <div className="discovery-actions">
                <Link
                  className="discovery-outline-link"
                  href={`/universities/${record.slug}`}
                  localeOverride={locale}
                >
                  {ui.viewGuide} <DiscoveryIcon name="arrow" />
                </Link>
                <Link href={`/changes/${record.slug}`} localeOverride={locale}>
                  {ui.history}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="home-v6-section" aria-labelledby="home-v6-recent">
        <div className="home-v6-section-heading">
          <h2 id="home-v6-recent">{design.recent}</h2>
          <Link href="/changes" localeOverride={locale}>
            {design.allUpdates} →
          </Link>
        </div>
        <ul className="home-v6-recent">
          {recentChanges.slice(0, 3).map((record) => (
            <li key={record.slug}>
              <UniversityMark slug={record.slug} />
              <div>
                <h3>
                  <Link href={record.changeUrl} localeOverride={locale}>
                    {record.name}
                  </Link>
                </h3>
                <p>
                  {[
                    universities.find((r) => r.slug === record.slug)?.region,
                    universities.find((r) => r.slug === record.slug)?.country,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
              <Link href={record.changeUrl} localeOverride={locale}>
                {design.viewUpdate} →
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <details className="home-v6-support">
        <summary>{copy.openDataHeading}</summary>
        <div className="home-v6-pillars">
          <article>
            <h3>{copy.sourcesPillarTitle}</h3>
            <p>{copy.sourcesPillarText}</p>
            <Link href="/sources" localeOverride={locale}>
              {copy.sourcesLink}
            </Link>
            <Link href="/methodology" localeOverride={locale}>
              {copy.methodologyLink}
            </Link>
          </article>
          <article>
            <h3>{copy.citationPillarTitle}</h3>
            <p>{copy.citationPillarText}</p>
            <Link href="/citation" localeOverride={locale}>
              {copy.citationLink}
            </Link>
          </article>
          <article>
            <h3>{copy.developerPillarTitle}</h3>
            <p>{copy.developerPillarText}</p>
            <p>{copy.rightsNote}</p>
            <Link href="/datasets" localeOverride={locale}>
              {copy.datasetsLink}
            </Link>
            <Link href="/api-reference" localeOverride={locale}>
              {copy.apiLink}
            </Link>
            <Link href="/mcp" localeOverride={locale}>
              {copy.mcpLink}
            </Link>
          </article>
        </div>
      </details>
      <section
        className="home-v6-section home-v6-faq-section"
        aria-labelledby="home-v6-faq"
      >
        <div className="home-v6-section-heading">
          <h2 id="home-v6-faq">{copy.faqHeading}</h2>
        </div>
        <div className="home-v6-faq">
          {copy.faqItems.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
