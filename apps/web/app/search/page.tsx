import Link from "next/link";
import { PUBLIC_API_VERSION } from "@uapt/shared";
import { DataList, DataListRow } from "@/components/data-list";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import {
  getEntityResolutionRecords,
  getSearchIndexRecords,
  searchIndexRecords,
  type SearchIndexRecord
} from "@/lib/entity-search";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "Search | University AI Policy Tracker";
const description =
  "Search public university AI policy records by university name, alias, source domain, claim text, and analysis dimension.";

const exampleQueries = ["MIT", "privacy", "disclosure", "Copilot", "harvard.edu"] as const;

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
  }>;
}

export function generateMetadata() {
  const canonical = getAbsoluteSiteUrl("/search");

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

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const [searchIndex, entityIndex] = await Promise.all([
    fetchSearchIndexRecords(),
    fetchEntityIndexSummary()
  ]);
  const results = searchIndexRecords(searchIndex, query, { limit: 30 });
  const suggestedRecords = [...searchIndex]
    .sort(
      (left, right) =>
        right.claimCount - left.claimCount ||
        right.sourceCount - left.sourceCount ||
        left.entityName.localeCompare(right.entityName)
    )
    .slice(0, 8);

  return (
    <main className="page-shell page-shell--wide">
      <section className="search-page-header" aria-labelledby="search-title">
        <div>
          <p className="kicker">Search</p>
          <h1 id="search-title">Find a public record</h1>
        </div>
        <form action="/search" className="home-search-form" method="get">
          <label className="visually-hidden" htmlFor="search-page-input">
            Search public records
          </label>
          <input
            defaultValue={query}
            id="search-page-input"
            name="q"
            placeholder="University, topic, source domain..."
            type="search"
          />
          <button type="submit">Search</button>
        </form>
      </section>

      <div className="quick-query-row" aria-label="Search examples">
        {exampleQueries.map((example) => (
          <Link href={`/search?q=${encodeURIComponent(example)}`} key={example}>
            {example}
          </Link>
        ))}
      </div>

      <section className="metrics-grid metrics-grid--compact" aria-label="Search coverage">
        <div>
          <span>{entityIndex.count}</span>
          <p>entities</p>
        </div>
        <div>
          <span>{entityIndex.aliasCount}</span>
          <p>aliases</p>
        </div>
        <div>
          <span>{query ? results.length : suggestedRecords.length}</span>
          <p>{query ? "matches" : "suggested records"}</p>
        </div>
        <div>
          <span>v1</span>
          <p>search API</p>
        </div>
      </section>

      <p className="compact-note">
        Search is a routing aid over promoted public records, not a policy
        conclusion.
      </p>

      <section className="section compact-section">
        <div className="section-heading">
          <h2>{query ? `Results for "${query}"` : "High-signal records"}</h2>
          {query ? <Link href="/search">Reset</Link> : null}
        </div>

        {query ? (
          results.length ? (
            <SearchResults results={results} />
          ) : (
            <p className="notice-card">
              No public records match this query. The current public release may
              still lack a promoted record for that institution or topic.
            </p>
          )
        ) : (
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
                <p>{record.fields.summary ?? "Open the public record."}</p>
              </DataListRow>
            ))}
          </DataList>
        )}
      </section>

      <ReferenceBox
        className="compact-reference-box"
        description="Read-only public search contracts."
        title="Search APIs"
      >
        <ul className="compact-link-list">
          <li>
            <a href={`/api/public/${PUBLIC_API_VERSION}/search.json?q=mit`}>
              Search JSON
            </a>
          </li>
          <li>
            <a href={`/api/public/${PUBLIC_API_VERSION}/search/index.json`}>
              Search index
            </a>
          </li>
          <li>
            <a href={`/api/public/${PUBLIC_API_VERSION}/entities/index.json`}>
              Entity aliases
            </a>
          </li>
        </ul>
      </ReferenceBox>
    </main>
  );
}

type SearchResult = ReturnType<typeof searchIndexRecords>[number];

async function fetchSearchIndexRecords(): Promise<SearchIndexRecord[]> {
  const payload = await fetchPublicJson<{
    data?: {
      records?: SearchIndexRecord[];
    };
  }>(`/api/public/${PUBLIC_API_VERSION}/search/index.json`);

  if (Array.isArray(payload?.data?.records)) return payload.data.records;

  return getSearchIndexRecords();
}

async function fetchEntityIndexSummary(): Promise<{
  aliasCount: number;
  count: number;
}> {
  const payload = await fetchPublicJson<{
    data?: {
      aliasCount?: number;
      count?: number;
    };
  }>(`/api/public/${PUBLIC_API_VERSION}/entities/index.json`);

  if (payload?.data) {
    return {
      aliasCount: Number(payload.data.aliasCount ?? 0),
      count: Number(payload.data.count ?? 0)
    };
  }

  const records = await getEntityResolutionRecords();

  return {
    aliasCount: records.reduce((total, record) => total + record.aliasCount, 0),
    count: records.length
  };
}

async function fetchPublicJson<T>(pathname: string): Promise<T | undefined> {
  try {
    const response = await fetch(getAbsoluteSiteUrl(pathname), {
      cache: "no-store"
    });

    if (!response.ok) return undefined;

    return (await response.json()) as T;
  } catch {
    return undefined;
  }
}

function SearchResults({ results }: { results: SearchResult[] }) {
  return (
    <DataList>
      {results.map((result) => (
        <DataListRow
          actions={
            <>
              <Link href={`/universities/${result.entitySlug}`}>Record</Link>
              <a href={result.publicJsonUrl}>JSON</a>
            </>
          }
          key={result.entitySlug}
          metadata={
            <>
              <MetaLabel label="Score">{result.score}</MetaLabel>
              <MetaLabel label="Claims">{result.claimCount}</MetaLabel>
              <MetaLabel label="Sources">{result.sourceCount}</MetaLabel>
            </>
          }
        >
          <div className="table-record-title">
            <Link href={`/universities/${result.entitySlug}`}>
              {result.entityName}
            </Link>
          </div>
          <p>{result.sourceBackedSnippet}</p>
          <div className="table-record-meta">
            <StateLabel reviewState={result.reviewState} />
            <MetaLabel label="Match">{result.matchReason}</MetaLabel>
            {result.confidence !== undefined ? (
              <MetaLabel label="Confidence">
                {Math.round(result.confidence * 100)}%
              </MetaLabel>
            ) : null}
          </div>
          {result.matchedAliases.length ? (
            <p className="table-record-subtitle">
              Alias: {result.matchedAliases.join(", ")}
            </p>
          ) : null}
        </DataListRow>
      ))}
    </DataList>
  );
}
