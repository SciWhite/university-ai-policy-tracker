"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import type {
  CatalogUniversityRanking,
  RankingSystemId
} from "@uapt/shared";
import { MetaLabel } from "@/components/meta-label";
import { StateLabel } from "@/components/state-label";
import type {
  StaticUniversityIndexRecord,
  UniversityIndexCoverageFilter,
  UniversityIndexRankingSystem,
  UniversityIndexSortKey,
  UniversityIndexSortOrder
} from "@/lib/university-index-records";

interface UniversitiesIndexClientProps {
  rankingSystems: UniversityIndexRankingSystem[];
  records: StaticUniversityIndexRecord[];
}

interface UniversityIndexFilters {
  coverage: UniversityIndexCoverageFilter;
  order: UniversityIndexSortOrder;
  q: string;
  ranking: RankingSystemId;
  sort: UniversityIndexSortKey;
}

const defaultFilters: UniversityIndexFilters = {
  coverage: "all",
  order: "asc",
  q: "",
  ranking: "qs",
  sort: "rank"
};

export function UniversitiesIndexClient({
  rankingSystems,
  records
}: UniversitiesIndexClientProps) {
  const [filters, setFilters] = useState<UniversityIndexFilters>(defaultFilters);

  useEffect(() => {
    const syncFromLocation = () => {
      setFilters(parseFilters(new URLSearchParams(window.location.search)));
    };

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);

    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  const selectedRankingLabel = getRankingLabel(filters.ranking, rankingSystems);
  const allRecords = useMemo(
    () => records.map((record) => withSelectedRanking(record, filters.ranking)),
    [filters.ranking, records]
  );
  const filteredRecords = useMemo(
    () =>
      sortRecords(
        filterRecords(allRecords, filters.q, filters.coverage),
        filters.sort,
        filters.order
      ),
    [allRecords, filters.coverage, filters.order, filters.q, filters.sort]
  );
  const totalClaims = records.reduce((total, record) => total + record.claimCount, 0);
  const reviewedClaims = records.filter((record) =>
    record.reviewedClaimCount
  ).reduce((total, record) => total + record.reviewedClaimCount, 0);
  const candidateClaims = totalClaims - reviewedClaims;
  const sourceCount = records.reduce(
    (total, record) => total + record.sourceCount,
    0
  );
  const rankedCount = allRecords.filter((record) => record.selectedRanking).length;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUrl = buildFilterUrl(filters);
    window.history.pushState({}, "", nextUrl);
  }

  function resetFilters() {
    setFilters(defaultFilters);
    window.history.pushState({}, "", "/universities");
  }

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
          <span>{records.length}</span>
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
          <p>{selectedRankingLabel} ranked records</p>
        </div>
      </section>

      <section
        className="section"
        data-ranking-system={filters.ranking}
        data-university-index-count={records.length}
      >
        <div className="section-heading">
          <h2>Repository-style index</h2>
          <p>
            QS ranking remains active. THE, ARWU, U.S. News, and CWTS are
            supported as ranking schemas and filters only when source rows match
            existing university records.
          </p>
        </div>

        <form
          action="/universities"
          className="university-filter-form"
          method="get"
          onSubmit={handleSubmit}
        >
          <label>
            <span>Search</span>
            <input
              name="q"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  q: event.target.value
                }))
              }
              placeholder="University, country, city"
              type="search"
              value={filters.q}
            />
          </label>
          <label>
            <span>Ranking</span>
            <select
              name="ranking"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  ranking: parseRankingSystem(event.target.value)
                }))
              }
              value={filters.ranking}
            >
              {rankingSystems.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Coverage</span>
            <select
              name="coverage"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  coverage: parseCoverageFilter(event.target.value)
                }))
              }
              value={filters.coverage}
            >
              <option value="all">All records</option>
              <option value="ranked">Ranked in selected system</option>
              <option value="missing">Missing selected rank</option>
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select
              name="sort"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  sort: parseSortKey(event.target.value)
                }))
              }
              value={filters.sort}
            >
              <option value="rank">Selected ranking</option>
              <option value="recent">Recently checked</option>
              <option value="name">University name</option>
              <option value="claims">Claim count</option>
              <option value="sources">Source count</option>
            </select>
          </label>
          <label>
            <span>Order</span>
            <select
              name="order"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  order: parseSortOrder(event.target.value)
                }))
              }
              value={filters.order}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
          <button type="submit">Apply</button>
          <button
            className="filter-reset-link"
            onClick={resetFilters}
            type="button"
          >
            Reset
          </button>
        </form>

        <div className="table-summary" data-university-visible-count={filteredRecords.length}>
          Showing {filteredRecords.length} of {records.length} records.{" "}
          {filters.q ? <>Search: &quot;{filters.q}&quot;. </> : null}
          Ranking view: {selectedRankingLabel}.
        </div>

        <div className="university-table-wrap">
          <table className="university-table">
            <thead>
              <tr>
                <th>University</th>
                <th>{selectedRankingLabel} rank</th>
                <th>Claims</th>
                <th>Sources</th>
                <th>Last checked</th>
                <th>Public JSON</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr data-university-row="" key={record.slug}>
                  <td>
                    <div className="table-record-title">
                      <Link href={`/universities/${record.slug}`}>
                        {record.name}
                      </Link>
                    </div>
                    <div className="table-record-subtitle">
                      {[record.region, record.country]
                        .filter((value) => value && value !== "Unknown")
                        .join(", ") || "Location unknown"}
                    </div>
                    <div className="table-record-meta">
                      {record.reviewState ? (
                        <StateLabel reviewState={record.reviewState} />
                      ) : null}
                      {record.confidence !== undefined ? (
                        <MetaLabel label="Confidence">
                          {Math.round(record.confidence * 100)}%
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

        {!filteredRecords.length ? (
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

type RecordWithSelectedRanking = StaticUniversityIndexRecord & {
  selectedRanking?: CatalogUniversityRanking;
};

function withSelectedRanking(
  record: StaticUniversityIndexRecord,
  rankingSystem: RankingSystemId
): RecordWithSelectedRanking {
  return {
    ...record,
    selectedRanking: record.rankings.find(
      (ranking) => ranking.systemId === rankingSystem
    )
  };
}

function filterRecords(
  records: RecordWithSelectedRanking[],
  query: string,
  coverage: UniversityIndexCoverageFilter
): RecordWithSelectedRanking[] {
  const normalizedQuery = query.trim().toLowerCase();

  return records.filter((record) => {
    if (coverage === "ranked" && !record.selectedRanking) return false;
    if (coverage === "missing" && record.selectedRanking) return false;
    if (!normalizedQuery) return true;

    return [record.name, record.country, record.region, record.summary]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  });
}

function sortRecords(
  records: RecordWithSelectedRanking[],
  sortKey: UniversityIndexSortKey,
  sortOrder: UniversityIndexSortOrder
): RecordWithSelectedRanking[] {
  const direction = sortOrder === "asc" ? 1 : -1;

  return [...records].sort((left, right) => {
    const comparison = compareRecords(left, right, sortKey);
    if (comparison) return comparison * direction;

    return left.name.localeCompare(right.name);
  });
}

function compareRecords(
  left: RecordWithSelectedRanking,
  right: RecordWithSelectedRanking,
  sortKey: UniversityIndexSortKey
): number {
  if (sortKey === "name") return left.name.localeCompare(right.name);
  if (sortKey === "claims") return left.claimCount - right.claimCount;
  if (sortKey === "sources") return left.sourceCount - right.sourceCount;
  if (sortKey === "recent") return getFreshnessTime(left) - getFreshnessTime(right);

  return getRankValue(left) - getRankValue(right);
}

function getRankValue(record: RecordWithSelectedRanking): number {
  return record.selectedRanking?.rankNumber ?? Number.MAX_SAFE_INTEGER;
}

function getFreshnessTime(record: StaticUniversityIndexRecord): number {
  const value = record.lastChangedAt ?? record.lastCheckedAt;

  return value ? new Date(value).getTime() : 0;
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

function parseFilters(params: URLSearchParams): UniversityIndexFilters {
  return {
    coverage: parseCoverageFilter(params.get("coverage") ?? ""),
    order: parseSortOrder(params.get("order") ?? ""),
    q: params.get("q") ?? "",
    ranking: parseRankingSystem(params.get("ranking") ?? ""),
    sort: parseSortKey(params.get("sort") ?? "")
  };
}

function buildFilterUrl(filters: UniversityIndexFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.ranking !== defaultFilters.ranking) params.set("ranking", filters.ranking);
  if (filters.coverage !== defaultFilters.coverage) {
    params.set("coverage", filters.coverage);
  }
  if (filters.sort !== defaultFilters.sort) params.set("sort", filters.sort);
  if (filters.order !== defaultFilters.order) params.set("order", filters.order);
  const query = params.toString();

  return query ? `/universities?${query}` : "/universities";
}

function parseRankingSystem(value: string): RankingSystemId {
  if (
    value === "qs" ||
    value === "the" ||
    value === "arwu" ||
    value === "usnews" ||
    value === "cwts"
  ) {
    return value;
  }

  return "qs";
}

function parseSortKey(value: string): UniversityIndexSortKey {
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

function parseSortOrder(value: string): UniversityIndexSortOrder {
  return value === "desc" ? "desc" : "asc";
}

function parseCoverageFilter(value: string): UniversityIndexCoverageFilter {
  if (value === "ranked" || value === "missing") return value;

  return "all";
}

function getRankingLabel(
  systemId: RankingSystemId,
  rankingSystems: UniversityIndexRankingSystem[]
): string {
  return rankingSystems.find((system) => system.id === systemId)?.label ?? "QS";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}
