import Link from "next/link";
import { headers } from "next/headers";
import { PUBLIC_API_VERSION } from "@uapt/shared";
import { DataList, DataListRow } from "@/components/data-list";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import {
  searchIndexRecords,
  type SearchIndexRecord
} from "@/lib/entity-search";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "Search | University AI Policy Tracker";
const description =
  "Search public university AI policy records by canonical names, aliases, domains, source titles, claims, and analysis dimensions.";

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
  const baseUrl = await getRequestBaseUrl();
  const [searchIndex, entityIndex] = await Promise.all([
    fetchSearchIndex(baseUrl),
    fetchEntityIndex(baseUrl)
  ]);
  const results = searchIndexRecords(searchIndex.records, query, { limit: 25 });
  const entityCount = entityIndex.count;
  const aliasCount = entityIndex.aliasCount;

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">Entity search</p>
        <h1>Find public AI policy records by name, alias, or source context</h1>
        <p className="lead">
          Search uses the public release only: canonical university names,
          aliases, official source titles, public claim text, and analysis
          dimension labels. It excludes raw source snapshots, private files,
          unpromoted staging evidence, and non-authoritative spreadsheet rows as
          policy evidence.
        </p>
      </section>

      <section className="metrics-grid" aria-label="Entity search coverage">
        <div>
          <span>{entityCount}</span>
          <p>public entities</p>
        </div>
        <div>
          <span>{aliasCount}</span>
          <p>entity aliases</p>
        </div>
        <div>
          <span>{results.length}</span>
          <p>matching results</p>
        </div>
        <div>
          <span>v1</span>
          <p>versioned search API</p>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Search public records</h2>
          <p>
            Aliases improve recall but do not create new facts. Open the
            canonical record for source URLs, original-language evidence,
            confidence, and review state.
          </p>
        </div>
        <form action="/search" className="university-filter-form" method="get">
          <label>
            <span>Query</span>
            <input
              defaultValue={query}
              name="q"
              placeholder="MIT, ANU, disclosure, copilot, harvard.edu"
              type="search"
            />
          </label>
          <button type="submit">Search</button>
          <Link className="filter-reset-link" href="/search">
            Reset
          </Link>
        </form>

        <p className="table-summary">
          {query
            ? `Showing ${results.length} result${results.length === 1 ? "" : "s"} for "${query}".`
            : "Enter a university name, abbreviation, source domain, policy theme, or AI service name."}
        </p>

        {results.length ? (
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
                    Alias matches: {result.matchedAliases.join(", ")}
                  </p>
                ) : null}
              </DataListRow>
            ))}
          </DataList>
        ) : query ? (
          <p className="notice-card">
            No public records match this query. This does not mean the
            institution has no AI policy; it only means the current public
            release has no matching promoted record.
          </p>
        ) : null}
      </section>

      <ReferenceBox
        description="Read-only JSON surfaces for entity resolution and safe search indexing."
        title="Search and entity APIs"
      >
        <ul className="compact-list">
          <li>
            <a href={`/api/public/${PUBLIC_API_VERSION}/search.json?q=mit`}>
              /api/public/{PUBLIC_API_VERSION}/search.json?q=mit
            </a>
          </li>
          <li>
            <a href={`/api/public/${PUBLIC_API_VERSION}/search/index.json`}>
              /api/public/{PUBLIC_API_VERSION}/search/index.json
            </a>
          </li>
          <li>
            <a href={`/api/public/${PUBLIC_API_VERSION}/entities/index.json`}>
              /api/public/{PUBLIC_API_VERSION}/entities/index.json
            </a>
          </li>
        </ul>
      </ReferenceBox>
    </main>
  );
}

async function getRequestBaseUrl(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";

  return host ? `${protocol}://${host}` : getAbsoluteSiteUrl("/");
}

async function fetchSearchIndex(baseUrl: string): Promise<{
  records: SearchIndexRecord[];
}> {
  const response = await fetch(
    new URL(`/api/public/${PUBLIC_API_VERSION}/search/index.json`, baseUrl),
    { next: { revalidate: 3600 } }
  );
  if (!response.ok) return { records: [] };

  const payload = (await response.json()) as {
    data?: {
      records?: SearchIndexRecord[];
    };
  };

  return {
    records: Array.isArray(payload.data?.records) ? payload.data.records : []
  };
}

async function fetchEntityIndex(baseUrl: string): Promise<{
  aliasCount: number;
  count: number;
}> {
  const response = await fetch(
    new URL(`/api/public/${PUBLIC_API_VERSION}/entities/index.json`, baseUrl),
    { next: { revalidate: 3600 } }
  );
  if (!response.ok) return { aliasCount: 0, count: 0 };

  const payload = (await response.json()) as {
    data?: {
      aliasCount?: number;
      count?: number;
    };
  };

  return {
    aliasCount: payload.data?.aliasCount ?? 0,
    count: payload.data?.count ?? 0
  };
}
