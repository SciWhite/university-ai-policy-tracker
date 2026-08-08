import type { Metadata } from "next";
import { PUBLIC_API_VERSION } from "@uapt/shared";
import { BrowseEntryGroups } from "@/components/browse-entry-groups";
import { DataList, DataListRow } from "@/components/data-list";
import { DocumentLink as Link } from "@/components/document-link";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { SearchAutocomplete } from "@/components/search-autocomplete";
import { StateLabel } from "@/components/state-label";
import { searchIndexRecords, getSearchIndexRecords } from "@/lib/entity-search";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";
import { getChangeRecords } from "@/lib/change-records";
import { getPolicyAnalysisProfiles } from "@/lib/policy-analysis";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { normalizeLocale } from "@/lib/i18n";
import { getBrowseEntryGroupsCopy, getPageCopy } from "@/lib/page-copy";
import { getStaticUniversityIndexRecords } from "@/lib/university-index-records";
import { IntentFlow } from "@/components/intent-flow";
import { getSiteOgImageUrl } from "@/components/site-opengraph";

const quickQueries = [
  "disclosure",
  "privacy",
  "coursework",
  "approved tools",
  "academic integrity"
] as const;

// The "sample results" section below the search hero is a pre-run search for
// this query, not a curated or complete list.
const sampleQuery = "disclosure";

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
  const dynamicTitle = copy.metadataTitle(formatNumber(universities.length, locale));

  return {
    title: dynamicTitle,
    description: copy.description,
    alternates,
    openGraph: {
      title: dynamicTitle,
      description: copy.description,
      images: [getSiteOgImageUrl(locale)],
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
  const suggestedRecords = searchIndexRecords(searchRecords, sampleQuery, {
    limit: 5
  });
  const pageTitle = copy.metadataTitle(formatNumber(universities.length, locale));
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
          <h1 id="home-search-title">{copy.heading}</h1>
          <p className="lead lead--compact">{copy.lead}</p>
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
          <div className="tag-row hero-meta">
            <MetaLabel label={copy.publicJson}>{universitiesJsonPath}</MetaLabel>
            <MetaLabel label={copy.searchApi}>{searchJsonPath}</MetaLabel>
            <MetaLabel label={copy.license}>CC-BY-4.0 metadata</MetaLabel>
          </div>
        </div>
        <aside className="search-hero__side" aria-label="Public dataset counts">
          <div>
            <span>{formatNumber(universities.length, locale)}</span>
            <p>{copy.universityRecords}</p>
          </div>
          <div>
            <span>{formatNumber(claimCount, locale)}</span>
            <p>{copy.sourceBackedClaims}</p>
          </div>
          <div>
            <span>{formatNumber(sourceCount, locale)}</span>
            <p>{copy.officialSourceAttributions}</p>
          </div>
          <div>
            <span>{formatNumber(analysisProfiles.length, locale)}</span>
            <p>{copy.analysisProfiles}</p>
          </div>
        </aside>
      </section>

      <section aria-label={copy.answersLabel} className="answer-strip">
        {copy.homeAnswers.map((answer) => (
          <article className="answer-card" key={answer.title}>
            <h2>{answer.title}</h2>
            <p>{answer.text}</p>
          </article>
        ))}
      </section>

      <IntentFlow locale={locale} />

      <BrowseEntryGroups copy={getBrowseEntryGroupsCopy(locale)} locale={locale} />

      <section className="section compact-section">
        <div className="section-heading">
          <h2>{copy.matchingRecordsFor(sampleQuery)}</h2>
          <Link href={`/search?q=${encodeURIComponent(sampleQuery)}`}>
            {copy.openSearch}
          </Link>
        </div>
        <p className="compact-note">{copy.note}</p>
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
                  {getLocalizedInstitutionName(
                    record.entitySlug,
                    record.entityName,
                    locale
                  )}
                </Link>
              </div>
              <p data-i18n="preserve">{record.sourceBackedSnippet}</p>
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
              <div className="table-record-title">
                {getLocalizedInstitutionName(record.slug, record.name, locale)}
              </div>
              <p>
                {record.lastChangedAt
                  ? `${copy.changed} ${formatDate(record.lastChangedAt, locale)}`
                  : record.lastCheckedAt
                    ? `${copy.checked} ${formatDate(record.lastCheckedAt, locale)}`
                    : copy.noPublicFreshnessDate}
              </p>
            </DataListRow>
          ))}
        </DataList>
      </section>
    </main>
  );
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}
