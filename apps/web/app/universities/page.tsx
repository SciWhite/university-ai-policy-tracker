import Link from "next/link";
import type {
  CatalogUniversity,
  CatalogUniversityRanking,
  PublicEntitySummary,
  RankingSystemId
} from "@uapt/shared";
import {
  getCatalogUniversities,
  getPublicJsonUrl,
  getPublicUniversitySummaryBySlug
} from "@/lib/catalog";
import { MetaLabel } from "@/components/meta-label";
import { StateLabel } from "@/components/state-label";

export const metadata = {
  title: "Universities | University AI Policy Tracker"
};

type SearchParams = Record<string, string | string[] | undefined>;
type SortKey = "rank" | "recent" | "name" | "claims" | "sources";
type SortOrder = "asc" | "desc";
type CoverageFilter = "all" | "ranked" | "missing";

interface UniversitiesPageProps {
  searchParams?: Promise<SearchParams>;
}

interface UniversityIndexRecord {
  catalog: CatalogUniversity;
  claimCount: number;
  lastCheckedAt?: string;
  lastChangedAt?: string;
  publicJsonUrl: string;
  selectedRanking?: CatalogUniversityRanking;
  sourceCount: number;
  summary?: PublicEntitySummary;
}

const rankingSystems: { id: RankingSystemId; label: string }[] = [
  { id: "qs", label: "QS" },
  { id: "the", label: "THE" },
  { id: "arwu", label: "ARWU" },
  { id: "usnews", label: "U.S. News" },
  { id: "cwts", label: "CWTS Leiden" }
];

export default async function UniversitiesPage({
  searchParams
}: UniversitiesPageProps) {
  const params = (await searchParams) ?? {};
  const selectedRankingSystem = parseRankingSystem(readParam(params.ranking));
  const sortKey = parseSortKey(readParam(params.sort));
  const sortOrder = parseSortOrder(readParam(params.order));
  const coverage = parseCoverageFilter(readParam(params.coverage));
  const query = readParam(params.q).trim();
  const catalogUniversities = await getCatalogUniversities();
  const allRecords = await buildRecords(catalogUniversities, selectedRankingSystem);
  const records = sortRecords(
    filterRecords(allRecords, query, coverage),
    sortKey,
    sortOrder
  );
  const totalClaims = allRecords.reduce(
    (total, record) => total + record.claimCount,
    0
  );
  const reviewedClaims = allRecords.reduce(
    (total, record) =>
      total +
      (record.summary?.claims.filter((claim) =>
        isReviewedClaim(claim.reviewState)
      ).length ?? 0),
    0
  );
  const candidateClaims = totalClaims - reviewedClaims;
  const sourceCount = allRecords.reduce(
    (total, record) => total + record.sourceCount,
    0
  );
  const rankedCount = allRecords.filter((record) => record.selectedRanking).length;

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">Evidence records</p>
        <h1>Universities</h1>
        <p className="lead">
          Browse crawlable university AI policy records with source-backed claims,
          review state, ranking coverage, official source counts, and versioned
          public JSON links.
        </p>
      </section>

      <section className="metrics-grid" aria-label="University coverage">
        <div>
          <span>{allRecords.length}</span>
          <p>university records</p>
        </div>
        <div>
          <span>{totalClaims}</span>
          <p>source-backed claims</p>
        </div>
        <div>
          <span>{sourceCount}</span>
          <p>official source attributions</p>
        </div>
        <div>
          <span>{rankedCount}</span>
          <p>{getRankingLabel(selectedRankingSystem)} ranked records</p>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Repository-style index</h2>
          <p>
            QS ranking remains active. THE, ARWU, U.S. News, and CWTS are
            supported as ranking schemas and filters only when source rows match
            existing university records.
          </p>
        </div>

        <form action="/universities" className="university-filter-form">
          <label>
            <span>Search</span>
            <input
              defaultValue={query}
              name="q"
              placeholder="University, country, city"
              type="search"
            />
          </label>
          <label>
            <span>Ranking</span>
            <select defaultValue={selectedRankingSystem} name="ranking">
              {rankingSystems.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Coverage</span>
            <select defaultValue={coverage} name="coverage">
              <option value="all">All records</option>
              <option value="ranked">Ranked in selected system</option>
              <option value="missing">Missing selected rank</option>
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select defaultValue={sortKey} name="sort">
              <option value="rank">Selected ranking</option>
              <option value="recent">Recently checked</option>
              <option value="name">University name</option>
              <option value="claims">Claim count</option>
              <option value="sources">Source count</option>
            </select>
          </label>
          <label>
            <span>Order</span>
            <select defaultValue={sortOrder} name="order">
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
          <button type="submit">Apply</button>
          <Link className="filter-reset-link" href="/universities">
            Reset
          </Link>
        </form>

        <div className="table-summary">
          Showing {records.length} of {allRecords.length} records.{" "}
          {query ? <>Search: &quot;{query}&quot;. </> : null}
          Ranking view: {getRankingLabel(selectedRankingSystem)}.
        </div>

        <div className="university-table-wrap">
          <table className="university-table">
            <thead>
              <tr>
                <th>University</th>
                <th>{getRankingLabel(selectedRankingSystem)} rank</th>
                <th>Claims</th>
                <th>Sources</th>
                <th>Last checked</th>
                <th>Public JSON</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.catalog.slug}>
                  <td>
                    <div className="table-record-title">
                      <Link href={`/universities/${record.catalog.slug}`}>
                        {record.catalog.name}
                      </Link>
                    </div>
                    <div className="table-record-subtitle">
                      {[record.catalog.region, record.catalog.country]
                        .filter((value) => value && value !== "Unknown")
                        .join(", ") || "Location unknown"}
                    </div>
                    <div className="table-record-meta">
                      {record.summary ? (
                        <StateLabel reviewState={record.summary.reviewState} />
                      ) : null}
                      {record.summary?.confidence !== undefined ? (
                        <MetaLabel label="Confidence">
                          {Math.round(record.summary.confidence * 100)}%
                        </MetaLabel>
                      ) : null}
                    </div>
                  </td>
                  <td>{renderRanking(record.selectedRanking)}</td>
                  <td>{record.claimCount}</td>
                  <td>{record.sourceCount}</td>
                  <td>
                    {record.lastCheckedAt ? (
                      <span>{formatDate(record.lastCheckedAt)}</span>
                    ) : (
                      <span className="table-muted">Unknown</span>
                    )}
                  </td>
                  <td>
                    <a href={record.publicJsonUrl}>JSON</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!records.length ? (
          <p className="notice-card">
            No records match the current search and ranking coverage filters.
          </p>
        ) : null}
        {candidateClaims ? (
          <p className="notice-card">
            {candidateClaims} candidate or needs-review claim records remain
            visible for auditability. Review state is separate from confidence.
          </p>
        ) : null}
      </section>
    </main>
  );
}

async function buildRecords(
  catalogUniversities: CatalogUniversity[],
  selectedRankingSystem: RankingSystemId
): Promise<UniversityIndexRecord[]> {
  return Promise.all(
    catalogUniversities.map(async (catalog) => {
      const summary = await getPublicUniversitySummaryBySlug(catalog.slug);

      return {
        catalog,
        summary,
        claimCount: summary?.claims.length ?? 0,
        sourceCount:
          summary?.officialSources.length ??
          catalog.sourceCount ??
          catalog.sources.length,
        lastCheckedAt:
          summary?.lastCheckedAt ?? latestSourceDate(catalog, "lastCheckedAt"),
        lastChangedAt:
          summary?.lastChangedAt ?? latestSourceDate(catalog, "lastChangedAt"),
        publicJsonUrl: summary?.apiUrl ?? getPublicJsonUrl(catalog.slug),
        selectedRanking: catalog.rankings.find(
          (ranking) => ranking.systemId === selectedRankingSystem
        )
      };
    })
  );
}

function filterRecords(
  records: UniversityIndexRecord[],
  query: string,
  coverage: CoverageFilter
): UniversityIndexRecord[] {
  const normalizedQuery = query.toLowerCase();

  return records.filter((record) => {
    if (coverage === "ranked" && !record.selectedRanking) return false;
    if (coverage === "missing" && record.selectedRanking) return false;
    if (!normalizedQuery) return true;

    return [
      record.catalog.name,
      record.catalog.country,
      record.catalog.region,
      record.summary?.summary
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  });
}

function sortRecords(
  records: UniversityIndexRecord[],
  sortKey: SortKey,
  sortOrder: SortOrder
): UniversityIndexRecord[] {
  const direction = sortOrder === "asc" ? 1 : -1;

  return [...records].sort((left, right) => {
    const comparison = compareRecords(left, right, sortKey);
    if (comparison) return comparison * direction;

    return left.catalog.name.localeCompare(right.catalog.name);
  });
}

function compareRecords(
  left: UniversityIndexRecord,
  right: UniversityIndexRecord,
  sortKey: SortKey
): number {
  if (sortKey === "name") {
    return left.catalog.name.localeCompare(right.catalog.name);
  }

  if (sortKey === "claims") return left.claimCount - right.claimCount;
  if (sortKey === "sources") return left.sourceCount - right.sourceCount;

  if (sortKey === "recent") {
    return getFreshnessTime(left) - getFreshnessTime(right);
  }

  return getRankValue(left) - getRankValue(right);
}

function getRankValue(record: UniversityIndexRecord): number {
  return record.selectedRanking?.rankNumber ?? Number.MAX_SAFE_INTEGER;
}

function getFreshnessTime(record: UniversityIndexRecord): number {
  const value =
    record.lastChangedAt ?? record.lastCheckedAt ?? latestSourceDate(record.catalog, "lastChangedAt");

  return value ? new Date(value).getTime() : 0;
}

function latestSourceDate(
  university: CatalogUniversity,
  key: "lastCheckedAt" | "lastChangedAt"
): string | undefined {
  return university.sources
    .map((source) => source[key])
    .filter((value): value is string => Boolean(value))
    .sort(
      (left, right) => new Date(right).getTime() - new Date(left).getTime()
    )[0];
}

function renderRanking(ranking: CatalogUniversityRanking | undefined) {
  if (!ranking) return <span className="table-muted">Not indexed</span>;

  return (
    <span className="ranking-cell">
      <strong>{ranking.rankText}</strong>
      <span>
        {ranking.rankingYear}
        {ranking.status === "partial" ? " · partial source" : ""}
        {ranking.rankType === "derived_metric_order" ? " · derived order" : ""}
      </span>
    </span>
  );
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parseRankingSystem(value: string): RankingSystemId {
  return rankingSystems.some((system) => system.id === value)
    ? (value as RankingSystemId)
    : "qs";
}

function parseSortKey(value: string): SortKey {
  if (
    value === "rank" ||
    value === "recent" ||
    value === "name" ||
    value === "claims" ||
    value === "sources"
  ) {
    return value;
  }

  return "rank";
}

function parseSortOrder(value: string): SortOrder {
  return value === "desc" ? "desc" : "asc";
}

function parseCoverageFilter(value: string): CoverageFilter {
  if (value === "ranked" || value === "missing") return value;

  return "all";
}

function getRankingLabel(systemId: RankingSystemId): string {
  return rankingSystems.find((system) => system.id === systemId)?.label ?? "QS";
}

function isReviewedClaim(reviewState: string): boolean {
  return reviewState === "agent_reviewed" || reviewState === "human_reviewed";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}
