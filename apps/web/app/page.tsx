import Link from "next/link";
import type { Metadata } from "next";
import { PUBLIC_API_VERSION } from "@uapt/shared";
import { DataList, DataListRow } from "@/components/data-list";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { StateLabel } from "@/components/state-label";
import { searchIndexRecords, getSearchIndexRecords } from "@/lib/entity-search";
import { getChangeRecords } from "@/lib/change-records";
import { getPolicyAnalysisProfiles } from "@/lib/policy-analysis";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { getStaticUniversityIndexRecords } from "@/lib/university-index-records";

const title = "University AI Policy Tracker";
const description =
  "Search public, source-backed university AI policy records, official sources, review states, changes, datasets, and citation-ready public JSON.";

const quickQueries = [
  "disclosure",
  "privacy",
  "coursework",
  "approved tools",
  "academic integrity"
] as const;

const entryGroups = [
  {
    title: "Records",
    links: [
      { label: "Universities", href: "/universities" },
      { label: "Analysis", href: "/analysis" },
      { label: "Changes", href: "/changes" }
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
    title: "Trust",
    links: [
      { label: "Methodology", href: "/methodology" },
      { label: "Citation", href: "/citation" },
      { label: "Contribute", href: "/contribute" }
    ]
  }
] as const;

export function generateMetadata(): Metadata {
  const canonical = getAbsoluteSiteUrl("/");

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
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
              name: "University AI Policy Tracker",
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
                  contentUrl: getAbsoluteSiteUrl(
                    `/api/public/${PUBLIC_API_VERSION}/universities.json`
                  ),
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
          <p className="kicker">AI policy database</p>
          <h1 id="home-search-title">Search university AI policy records</h1>
          <form action="/search" className="home-search-form" method="get">
            <label className="visually-hidden" htmlFor="home-search-input">
              Search public university AI policy records
            </label>
            <input
              id="home-search-input"
              name="q"
              placeholder="Search universities, topics, source domains..."
              type="search"
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
            Search routes to source-backed public records. It is not a policy
            conclusion.
          </p>
        </div>
        <aside className="search-hero__side" aria-label="Public dataset counts">
          <div>
            <span>{universities.length}</span>
            <p>universities</p>
          </div>
          <div>
            <span>{claimCount}</span>
            <p>claims</p>
          </div>
          <div>
            <span>{sourceCount}</span>
            <p>sources</p>
          </div>
          <div>
            <span>{analysisProfiles.length}</span>
            <p>analysis profiles</p>
          </div>
        </aside>
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
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}
