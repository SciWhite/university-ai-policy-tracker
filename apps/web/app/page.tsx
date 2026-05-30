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
import { getStaticUniversityIndexRecords } from "@/lib/university-index-records";

const formatter = new Intl.NumberFormat("en");
const title = "University AI Policy Tracker";
const description =
  "Search and cite source-backed university GenAI policy records with official sources, review states, public JSON, and citation-ready evidence.";

const quickQueries = [
  "disclosure",
  "privacy",
  "coursework",
  "approved tools",
  "academic integrity"
] as const;

const entryGroups = [
  {
    title: "Start",
    links: [
      { label: "Search records", href: "/search" },
      { label: "Universities", href: "/universities" },
      { label: "AI Policy Database", href: "/university-ai-policy-database" }
    ]
  },
  {
    title: "Data and API",
    links: [
      { label: "Datasets", href: "/datasets" },
      { label: "API", href: "/api-reference" },
      { label: "MCP", href: "/mcp" },
      { label: "Widgets", href: "/widgets" }
    ]
  },
  {
    title: "Updates",
    links: [
      { label: "Changes", href: "/changes" },
      { label: "Reports", href: "/reports" },
      { label: "Feeds", href: "/feeds/atom.xml" }
    ]
  },
  {
    title: "Coverage and review",
    links: [
      { label: "Coverage", href: "/coverage" },
      { label: "Source health", href: "/source-health" },
      { label: "Review", href: "/review" },
      { label: "Queue", href: "/review/queue" }
    ]
  },
  {
    title: "Trust and citation",
    links: [
      { label: "Methodology", href: "/methodology" },
      { label: "Citation", href: "/citation" },
      { label: "llms.txt", href: "/llms.txt" },
      { label: "Contribute", href: "/contribute" }
    ]
  }
] as const;

const homeAnswers = [
  {
    title: "What this database is",
    text:
      "A public, source-backed index of university GenAI policy records with canonical pages, review state, source URLs, evidence snippets, and public JSON."
  },
  {
    title: "What this database is not",
    text: `${NO_ADVICE_BOUNDARY} Official university source pages remain canonical.`
  },
  {
    title: "How to cite records",
    text:
      "Cite the visible record page and matching public JSON together, then preserve source URL, review state, confidence, last checked date, and original-language evidence."
  }
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
  const alternates = getLocalizedAlternates("/", locale);
  const canonical = String(alternates.canonical);
  const universities = await getStaticUniversityIndexRecords();
  const dynamicTitle = buildHomeTitle(universities.length);

  return {
    title: dynamicTitle,
    description,
    alternates,
    openGraph: {
      title: dynamicTitle,
      description,
      url: canonical,
      type: "website"
    }
  };
}

export default async function HomePage() {
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
  const pageTitle = buildHomeTitle(universities.length);
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
              description,
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
              mainEntity: homeAnswers.map((answer) => ({
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
          <p className="kicker">University AI policy database</p>
          <h1 id="home-search-title">{pageTitle}</h1>
          <p className="lead lead--compact">
            Find, cite, and retrieve source-backed university GenAI policy
            records. Search by institution, source domain, AI tool, policy
            theme, or public evidence phrase.
          </p>
          <form action="/search" className="home-search-form" method="get">
            <label className="visually-hidden" htmlFor="home-search-input">
              Search public university AI policy records
            </label>
            <SearchAutocomplete
              id="home-search-input"
              name="q"
              placeholder="Search universities, topics, source domains..."
            />
            <button type="submit">Search</button>
          </form>
          <div className="quick-query-row" aria-label="Suggested searches">
            {quickQueries.map((query) => (
              <Link href={`/search?q=${encodeURIComponent(query)}`} key={query}>
                {query}
              </Link>
            ))}
          </div>
          <p className="compact-note">
            Search is a routing aid over promoted public records, not a policy
            conclusion. Open the record and public JSON before citation.
          </p>
          <div className="tag-row hero-meta">
            <MetaLabel label="Public JSON">{universitiesJsonPath}</MetaLabel>
            <MetaLabel label="Search API">{searchJsonPath}</MetaLabel>
            <MetaLabel label="License">CC-BY-4.0 metadata</MetaLabel>
          </div>
        </div>
        <aside className="search-hero__side" aria-label="Public dataset counts">
          <div>
            <span>{formatNumber(universities.length)}</span>
            <p>university records</p>
          </div>
          <div>
            <span>{formatNumber(claimCount)}</span>
            <p>source-backed claims</p>
          </div>
          <div>
            <span>{formatNumber(sourceCount)}</span>
            <p>official source attributions</p>
          </div>
          <div>
            <span>{formatNumber(analysisProfiles.length)}</span>
            <p>analysis profiles</p>
          </div>
        </aside>
      </section>

      <section className="answer-strip" aria-label="Database answer blocks">
        {homeAnswers.map((answer) => (
          <article className="answer-card" key={answer.title}>
            <h2>{answer.title}</h2>
            <p>{answer.text}</p>
          </article>
        ))}
      </section>

      <section className="entry-group-grid" aria-label="Secondary entrances">
        {entryGroups.map((group) => (
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
          <h2>Matching records</h2>
          <Link href="/search?q=disclosure">Open search</Link>
        </div>
        <DataList>
          {suggestedRecords.map((record) => (
            <DataListRow
              actions={
                <>
                  <Link href={`/universities/${record.entitySlug}`}>Record</Link>
                  <a href={record.publicJsonUrl}>JSON</a>
                </>
              }
              key={record.entitySlug}
              metadata={
                <>
                  <StateLabel reviewState={record.reviewState} />
                  <MetaLabel label="Claims">{record.claimCount}</MetaLabel>
                  <MetaLabel label="Sources">{record.sourceCount}</MetaLabel>
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
          <h2>Recent checks</h2>
          <Link href="/changes">View changes</Link>
        </div>
        <DataList>
          {recentRecords.map((record) => (
            <DataListRow
              actions={
                <>
                  <Link href={record.universityUrl}>Record</Link>
                  <a href={record.publicJsonUrl}>JSON</a>
                </>
              }
              key={record.slug}
              metadata={
                <>
                  <StateLabel reviewState={record.reviewState} />
                  <MetaLabel label="Claims">{record.claimCount}</MetaLabel>
                  <MetaLabel label="Sources">{record.sourceCount}</MetaLabel>
                </>
              }
            >
              <div className="table-record-title">{record.name}</div>
              <p>
                {record.lastChangedAt
                  ? `Changed ${formatDate(record.lastChangedAt)}`
                  : record.lastCheckedAt
                    ? `Checked ${formatDate(record.lastCheckedAt)}`
                    : "No public freshness date"}
              </p>
            </DataListRow>
          ))}
        </DataList>
      </section>

      <section className="section compact-section">
        <div className="section-heading">
          <h2>Agent and citation retrieval</h2>
          <p>Use canonical pages and versioned public JSON together.</p>
        </div>
        <div className="detail-grid">
          <article className="policy-card">
            <h3>For AI/search systems</h3>
            <p>
              Resolve an entity with search, open the canonical university
              record, then cite claim evidence and public JSON fields without
              replacing official university source language.
            </p>
            <div className="tag-row">
              <Link href="/university-ai-policy-database">
                AI/search reference
              </Link>
              <Link href="/llms.txt">llms.txt</Link>
            </div>
          </article>
          <article className="policy-card">
            <h3>For researchers and journalists</h3>
            <p>
              Treat tracker metadata as a citation layer. Official source
              pages, PDFs, and policy documents keep their own rights and
              remain the final source for institutional wording.
            </p>
            <div className="tag-row">
              <Link href="/citation">Citation guide</Link>
              <Link href="/methodology">Methodology</Link>
            </div>
          </article>
          <article className="policy-card">
            <h3>For developers</h3>
            <p>
              Public endpoints expose read-only records, search, entities,
              datasets, recent changes, analysis profiles, and citation
              metadata under the versioned API namespace.
            </p>
            <div className="tag-row">
              <Link href="/api-reference">API docs</Link>
              <Link href={`/api/public/${PUBLIC_API_VERSION}/index.json`}>
                API index
              </Link>
            </div>
          </article>
        </div>
        <p className="notice-card">{OFFICIAL_SOURCE_RIGHTS_CAVEAT}</p>
      </section>
    </main>
  );
}

function buildHomeTitle(universityCount: number): string {
  return `University AI Policy Database: Search ${formatNumber(universityCount)} Source-Backed GenAI Policies`;
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
