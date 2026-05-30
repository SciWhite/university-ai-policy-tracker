import type { Metadata } from "next";
import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION
} from "@uapt/shared";
import { DataList, DataListRow } from "@/components/data-list";
import { DocumentLink as Link } from "@/components/document-link";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { SearchAutocomplete } from "@/components/search-autocomplete";
import { StateLabel } from "@/components/state-label";
import { searchIndexRecords, getSearchIndexRecords } from "@/lib/entity-search";
import { getChangeRecords } from "@/lib/change-records";
import { getPolicyAnalysisProfiles } from "@/lib/policy-analysis";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { normalizeLocale } from "@/lib/i18n";
import { getPageCopy } from "@/lib/page-copy";
import { getStaticUniversityIndexRecords } from "@/lib/university-index-records";

const formatter = new Intl.NumberFormat("en");

const quickQueries = [
  "disclosure",
  "privacy",
  "coursework",
  "approved tools",
  "academic integrity"
] as const;

interface HomePageProps {
  params?: Promise<{
    locale?: string;
  }>;
}

export async function generateMetadata({
  params
}: HomePageProps = {}): Promise<Metadata> {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).home;
  const alternates = getLocalizedAlternates("/", locale);
  const canonical = String(alternates.canonical);
  const universities = await getStaticUniversityIndexRecords();
  const dynamicTitle = copy.metadataTitle(formatNumber(universities.length));

  return {
    title: dynamicTitle,
    description: copy.description,
    alternates,
    openGraph: {
      title: dynamicTitle,
      description: copy.description,
      url: canonical,
      type: "website"
    }
  };
}

export default async function HomePage({ params }: HomePageProps) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).home;
  const [universities, analysisProfiles, changeRecords, searchRecords] =
    await Promise.all([
      getStaticUniversityIndexRecords(),
      getPolicyAnalysisProfiles(),
      getChangeRecords(),
      getSearchIndexRecords()
    ]);
  const claimCount = universities.reduce(
    (total, university) => total + university.claimCount,
    0
  );
  const sourceCount = universities.reduce(
    (total, university) => total + university.sourceCount,
    0
  );
  const recentRecords = changeRecords.slice(0, 5);
  const suggestedRecords = searchIndexRecords(searchRecords, "disclosure", {
    limit: 5
  });
  const pageTitle = copy.metadataTitle(formatNumber(universities.length));
  const universitiesJsonPath = `/api/public/${PUBLIC_API_VERSION}/universities.json`;
  const searchJsonPath = `/api/public/${PUBLIC_API_VERSION}/search.json?q=chatgpt`;

  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@id": getAbsoluteSiteUrl("/#organization"),
              "@type": "Organization",
              name: "University AI Policy Tracker",
              sameAs: [
                "https://github.com/SciWhite/university-ai-policy-tracker"
              ],
              url: getAbsoluteSiteUrl("/")
            },
            {
              "@id": getAbsoluteSiteUrl("/#website"),
              "@type": "WebSite",
              description: copy.description,
              name: pageTitle,
              potentialAction: {
                "@type": "SearchAction",
                "query-input": "required name=search_term_string",
                target: getAbsoluteSiteUrl(
                  "/search?q={search_term_string}"
                )
              },
              publisher: {
                "@id": getAbsoluteSiteUrl("/#organization")
              },
              url: getAbsoluteSiteUrl("/")
            },
            {
              "@id": getAbsoluteSiteUrl("/#faq"),
              "@type": "FAQPage",
              mainEntity: copy.homeAnswers.map((answer) => ({
                "@type": "Question",
                name: answer.title,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: answer.text
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

      <section className="search-hero" aria-labelledby="home-search-title">
        <div>
          <p className="kicker">{copy.kicker}</p>
          <h1 id="home-search-title">{pageTitle}</h1>
          <p className="lead lead--compact">
            {copy.lead}
          </p>
          <form action="/search" className="home-search-form" method="get">
            <label className="visually-hidden" htmlFor="home-search-input">
              {copy.searchLabel}
            </label>
            <SearchAutocomplete
              id="home-search-input"
              name="q"
              placeholder={copy.searchPlaceholder}
            />
            <button type="submit">{copy.searchButton}</button>
          </form>
          <div className="quick-query-row" aria-label={copy.suggestedSearches}>
            {quickQueries.map((query) => (
              <Link href={`/search?q=${encodeURIComponent(query)}`} key={query}>
                {query}
              </Link>
            ))}
          </div>
          <p className="compact-note">
            {copy.note}
          </p>
          <div className="tag-row hero-meta">
            <MetaLabel label={copy.publicJson}>{universitiesJsonPath}</MetaLabel>
            <MetaLabel label={copy.searchApi}>{searchJsonPath}</MetaLabel>
            <MetaLabel label={copy.license}>CC-BY-4.0 metadata</MetaLabel>
          </div>
        </div>
        <aside className="search-hero__side" aria-label="Public dataset counts">
          <div>
            <span>{formatNumber(universities.length)}</span>
            <p>{copy.universityRecords}</p>
          </div>
          <div>
            <span>{formatNumber(claimCount)}</span>
            <p>{copy.sourceBackedClaims}</p>
          </div>
          <div>
            <span>{formatNumber(sourceCount)}</span>
            <p>{copy.officialSourceAttributions}</p>
          </div>
          <div>
            <span>{formatNumber(analysisProfiles.length)}</span>
            <p>{copy.analysisProfiles}</p>
          </div>
        </aside>
      </section>

      <section className="answer-strip" aria-label={copy.answersLabel}>
        {copy.homeAnswers.map((answer) => (
          <article className="answer-card" key={answer.title}>
            <h2>{answer.title}</h2>
            <p>{answer.text}</p>
          </article>
        ))}
      </section>

      <section className="entry-group-grid" aria-label={copy.entryGroupsLabel}>
        {copy.entryGroups.map((group) => (
          <section className="entry-group" key={group.title}>
            <h2>{group.title}</h2>
            <ul>
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </section>

      <section className="section compact-section">
        <div className="section-heading">
          <h2>{copy.matchingRecords}</h2>
          <Link href="/search?q=disclosure">{copy.openSearch}</Link>
        </div>
        <DataList>
          {suggestedRecords.map((record) => (
            <DataListRow
              actions={
                <>
                  <Link href={`/universities/${record.entitySlug}`}>{copy.record}</Link>
                  <a href={record.publicJsonUrl}>JSON</a>
                </>
              }
              key={record.entitySlug}
              metadata={
                <>
                  <StateLabel reviewState={record.reviewState} />
                  <MetaLabel label={copy.claims}>{record.claimCount}</MetaLabel>
                  <MetaLabel label={copy.sources}>{record.sourceCount}</MetaLabel>
                </>
              }
            >
              <div className="table-record-title">
                <Link href={`/universities/${record.entitySlug}`}>
                  {record.entityName}
                </Link>
              </div>
              <p>{record.sourceBackedSnippet}</p>
            </DataListRow>
          ))}
        </DataList>
      </section>

      <section className="section compact-section">
        <div className="section-heading">
          <h2>{copy.recentChecks}</h2>
          <Link href="/changes">{copy.viewChanges}</Link>
        </div>
        <DataList>
          {recentRecords.map((record) => (
            <DataListRow
              actions={
                <>
                  <Link href={record.universityUrl}>{copy.record}</Link>
                  <a href={record.publicJsonUrl}>JSON</a>
                </>
              }
              key={record.slug}
              metadata={
                <>
                  <StateLabel reviewState={record.reviewState} />
                  <MetaLabel label={copy.claims}>{record.claimCount}</MetaLabel>
                  <MetaLabel label={copy.sources}>{record.sourceCount}</MetaLabel>
                </>
              }
            >
              <div className="table-record-title">{record.name}</div>
              <p>
                {record.lastChangedAt
                  ? `${copy.changed} ${formatDate(record.lastChangedAt)}`
                  : record.lastCheckedAt
                    ? `${copy.checked} ${formatDate(record.lastCheckedAt)}`
                    : copy.noPublicFreshnessDate}
              </p>
            </DataListRow>
          ))}
        </DataList>
      </section>

      <section className="section compact-section">
        <div className="section-heading">
          <h2>{copy.agentRetrievalTitle}</h2>
          <p>{copy.agentRetrievalLead}</p>
        </div>
        <div className="detail-grid">
          <article className="policy-card">
            <h3>{copy.aiSystemsTitle}</h3>
            <p>{copy.aiSystemsText}</p>
            <div className="tag-row">
              <Link href="/university-ai-policy-database">
                {copy.aiSearchReference}
              </Link>
              <Link href="/llms.txt">llms.txt</Link>
            </div>
          </article>
          <article className="policy-card">
            <h3>{copy.researchersTitle}</h3>
            <p>{copy.researchersText}</p>
            <div className="tag-row">
              <Link href="/citation">{copy.citationGuide}</Link>
              <Link href="/methodology">{copy.methodology}</Link>
            </div>
          </article>
          <article className="policy-card">
            <h3>{copy.developersTitle}</h3>
            <p>{copy.developersText}</p>
            <div className="tag-row">
              <Link href="/api-reference">{copy.apiDocs}</Link>
              <Link href={`/api/public/${PUBLIC_API_VERSION}/index.json`}>
                {copy.apiIndex}
              </Link>
            </div>
          </article>
        </div>
        <p className="notice-card">{OFFICIAL_SOURCE_RIGHTS_CAVEAT}</p>
      </section>
    </main>
  );
}

function formatNumber(value: number): string {
  return formatter.format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}
