"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  CatalogUniversityRanking,
  RankingSystemId
} from "@uapt/shared";
import { DocumentLink as Link } from "@/components/document-link";
import { MetaLabel } from "@/components/meta-label";
import { StateLabel } from "@/components/state-label";
import { localizeHref, type SupportedLocale } from "@/lib/i18n";
import {
  getInstitutionLocalizedAliasesByLocale,
  getLocalizedInstitutionName
} from "@/lib/institution-localization";
import { getPageCopy } from "@/lib/page-copy";
import { normalizeForSearch, textMatchesNormalized } from "@/lib/search-text";
import type {
  StaticUniversityIndexRecord,
  UniversityIndexCoverageFilter,
  UniversityIndexRankingSystem,
  UniversityIndexSortKey,
  UniversityIndexSortOrder
} from "@/lib/university-index-records";

interface UniversitiesIndexClientProps {
  initialRecords: StaticUniversityIndexRecord[];
  locale: SupportedLocale;
  priorityRecords: StaticUniversityIndexRecord[];
  rankingCounts: Record<string, number>;
  rankingSystems: UniversityIndexRankingSystem[];
  totalClaimCount: number;
  totalRecordCount: number;
  totalReviewedClaimCount: number;
  totalSourceCount: number;
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

const fullIndexPath = "/api/public/v1/university-index.json";

export function UniversitiesIndexClient({
  initialRecords,
  locale,
  priorityRecords,
  rankingCounts,
  rankingSystems,
  totalClaimCount,
  totalRecordCount,
  totalReviewedClaimCount,
  totalSourceCount
}: UniversitiesIndexClientProps) {
  const copy = getPageCopy(locale).universities;
  const [filters, setFilters] = useState<UniversityIndexFilters>(defaultFilters);
  const [records, setRecords] = useState(initialRecords);
  const [hasFullIndex, setHasFullIndex] = useState(false);
  const [isLoadingFullIndex, setIsLoadingFullIndex] = useState(false);
  const [fullIndexError, setFullIndexError] = useState(false);

  const loadFullIndex = useCallback(async () => {
    if (hasFullIndex || isLoadingFullIndex) return;

    setIsLoadingFullIndex(true);
    setFullIndexError(false);

    try {
      const response = await fetch(fullIndexPath);
      if (!response.ok) throw new Error(`Index request failed: ${response.status}`);
      const payload = (await response.json()) as {
        data?: {
          records?: StaticUniversityIndexRecord[];
        };
      };
      const nextRecords = payload.data?.records;
      if (!Array.isArray(nextRecords)) {
        throw new Error("Index response did not include records.");
      }
      setRecords(nextRecords);
      setHasFullIndex(true);
    } catch {
      setFullIndexError(true);
    } finally {
      setIsLoadingFullIndex(false);
    }
  }, [hasFullIndex, isLoadingFullIndex]);

  useEffect(() => {
    const syncFromLocation = () => {
      setFilters(parseFilters(new URLSearchParams(window.location.search)));
    };

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);

    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  useEffect(() => {
    if (!needsFullIndex(filters) || hasFullIndex) return;
    void loadFullIndex();
  }, [filters, hasFullIndex, loadFullIndex]);

  const selectedRankingLabel = getRankingLabel(filters.ranking, rankingSystems);
  const allRecords = useMemo(
    () => records.map((record) => withSelectedRanking(record, filters.ranking)),
    [filters.ranking, records]
  );
  const filteredRecords = useMemo(
    () =>
      sortRecords(
        filterRecords(allRecords, filters.q, filters.coverage, locale),
        filters.sort,
        filters.order,
        locale
      ),
    [allRecords, filters.coverage, filters.order, filters.q, filters.sort, locale]
  );
  const candidateClaims = totalClaimCount - totalReviewedClaimCount;
  const rankedCount = hasFullIndex
    ? allRecords.filter((record) => record.selectedRanking).length
    : (rankingCounts[filters.ranking] ?? 0);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUrl = buildFilterUrl(filters, locale);
    window.history.pushState({}, "", nextUrl);
  }

  function resetFilters() {
    setFilters(defaultFilters);
    window.history.pushState({}, "", localizeHref("/universities", locale));
  }

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">{copy.kicker}</p>
        <h1>{copy.heading}</h1>
        <p className="lead">{copy.lead}</p>
      </section>

      <section className="metrics-grid" aria-label={copy.coverageLabel}>
        <div>
          <span>{totalRecordCount}</span>
          <p>{copy.universityRecords}</p>
        </div>
        <div>
          <span>{totalClaimCount}</span>
          <p>{copy.sourceBackedClaims}</p>
        </div>
        <div>
          <span>{totalSourceCount}</span>
          <p>{copy.officialSourceAttributions}</p>
        </div>
        <div>
          <span>{rankedCount}</span>
          <p>{copy.rankedRecords(selectedRankingLabel)}</p>
        </div>
      </section>

      <section className="answer-strip" aria-label={copy.answersLabel}>
        {copy.answerCards.map((answer) => (
          <article className="answer-card" key={answer.title}>
            <h2>{answer.title}</h2>
            <p>{answer.text}</p>
          </article>
        ))}
      </section>

      {priorityRecords.length ? (
        <section className="section" aria-labelledby="priority-university-records">
          <div className="section-heading">
            <h2 id="priority-university-records">{copy.priorityTitle}</h2>
            <p>{copy.priorityLead}</p>
          </div>
          <div className="source-attribution-list">
            {priorityRecords.map((record) => {
              const displayName = getLocalizedInstitutionName(
                record.slug,
                record.name,
                locale
              );

              return (
                <article className="source-attribution-row" key={record.slug}>
                  <div>
                    <h3>{displayName}</h3>
                    <p>
                      {record.claimCount} source-backed AI policy{" "}
                      {record.claimCount === 1 ? "claim" : "claims"} from{" "}
                      {record.sourceCount} official source{" "}
                      {record.sourceCount === 1 ? "attribution" : "attributions"}.
                    </p>
                    <div className="tag-row">
                      {record.reviewState ? (
                        <StateLabel reviewState={record.reviewState} />
                      ) : null}
                      <MetaLabel label={copy.claims}>{record.claimCount}</MetaLabel>
                      <MetaLabel label={copy.sources}>{record.sourceCount}</MetaLabel>
                      {record.lastCheckedAt ? (
                        <MetaLabel label={copy.lastChecked}>
                          {formatDate(record.lastCheckedAt)}
                        </MetaLabel>
                      ) : null}
                    </div>
                  </div>
                  <div className="tag-row">
                    <Link href={`/universities/${record.slug}`}>
                      {copy.priorityRecordLink}
                    </Link>
                    <Link href={`/changes/${record.slug}`}>
                      {copy.priorityChangeLink}
                    </Link>
                    <Link href="/reports/monthly/2026-05">
                      {copy.priorityReportsLink}
                    </Link>
                    <a href={record.publicJsonUrl}>{copy.publicJson}</a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section
        className="section"
        data-ranking-system={filters.ranking}
        data-university-index-count={records.length}
      >
        <div className="section-heading">
          <h2>{copy.indexTitle}</h2>
          <p>{copy.indexLead}</p>
        </div>

        <form
          action={localizeHref("/universities", locale)}
          className="university-filter-form"
          method="get"
          onSubmit={handleSubmit}
        >
          <label>
            <span>{copy.search}</span>
            <input
              name="q"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  q: event.target.value
                }))
              }
              placeholder={copy.searchPlaceholder}
              type="search"
              value={filters.q}
            />
          </label>
          <label>
            <span>{copy.ranking}</span>
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
            <span>{copy.coverage}</span>
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
              <option value="all">{copy.allRecords}</option>
              <option value="ranked">{copy.rankedInSelectedSystem}</option>
              <option value="missing">{copy.missingSelectedRank}</option>
            </select>
          </label>
          <label>
            <span>{copy.sort}</span>
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
              <option value="rank">{copy.selectedRanking}</option>
              <option value="recent">{copy.recentlyChecked}</option>
              <option value="name">{copy.universityName}</option>
              <option value="claims">{copy.claimCount}</option>
              <option value="sources">{copy.sourceCount}</option>
            </select>
          </label>
          <label>
            <span>{copy.order}</span>
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
              <option value="asc">{copy.ascending}</option>
              <option value="desc">{copy.descending}</option>
            </select>
          </label>
          <button type="submit">{copy.apply}</button>
          <button
            className="filter-reset-link"
            onClick={resetFilters}
            type="button"
          >
            {copy.reset}
          </button>
        </form>

        <div className="table-summary" data-university-visible-count={filteredRecords.length}>
          {copy.showing(filteredRecords.length, totalRecordCount)}{" "}
          {filters.q ? <>{copy.searchSummary(filters.q)} </> : null}
          {copy.rankingView(selectedRankingLabel)}
        </div>
        {!hasFullIndex ? (
          <p className="notice-card">
            Showing a fast first page of {records.length.toLocaleString("en-US")}{" "}
            records. Search, filter, sort, or load the complete index to query all{" "}
            {totalRecordCount.toLocaleString("en-US")} records.{" "}
            <button
              className="filter-reset-link"
              disabled={isLoadingFullIndex}
              onClick={() => void loadFullIndex()}
              type="button"
            >
              {isLoadingFullIndex ? "Loading..." : "Load complete index"}
            </button>
          </p>
        ) : null}
        {fullIndexError ? (
          <p className="notice-card">
            The complete index could not be loaded. Public JSON remains available
            from the dataset links.
          </p>
        ) : null}

        <div className="university-table-wrap">
          <table className="university-table">
            <thead>
              <tr>
                <th>{copy.university}</th>
                <th>{copy.rank(selectedRankingLabel)}</th>
                <th>{copy.claims}</th>
                <th>{copy.sources}</th>
                <th>{copy.lastChecked}</th>
                <th>{copy.publicJson}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr data-university-row="" key={record.slug}>
                  <td>
                    <div className="table-record-title">
                      <Link href={`/universities/${record.slug}`}>
                        {getLocalizedInstitutionName(
                          record.slug,
                          record.name,
                          locale
                        )}
                      </Link>
                    </div>
                    <div className="table-record-subtitle">
                      {[record.region, record.country]
                        .filter((value) => value && value !== "Unknown")
                        .join(", ") || copy.locationUnknown}
                    </div>
                    <div className="table-record-meta">
                      {record.reviewState ? (
                        <StateLabel reviewState={record.reviewState} />
                      ) : null}
                      {record.confidence !== undefined ? (
                        <MetaLabel label={copy.confidence}>
                          {Math.round(record.confidence * 100)}%
                        </MetaLabel>
                      ) : null}
                    </div>
                  </td>
                  <td>{renderRanking(record.selectedRanking, copy)}</td>
                  <td>{record.claimCount}</td>
                  <td>{record.sourceCount}</td>
                  <td>
                    {record.lastCheckedAt ? (
                      <span>{formatDate(record.lastCheckedAt)}</span>
                    ) : (
                      <span className="table-muted">{copy.unknown}</span>
                    )}
                  </td>
                  <td>
                    <a href={record.publicJsonUrl}>{copy.json}</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filteredRecords.length ? (
          <p className="notice-card">
            {copy.noMatches}
          </p>
        ) : null}
        {candidateClaims ? (
          <p className="notice-card">
            {copy.candidateNotice(candidateClaims)}
          </p>
        ) : null}
      </section>
    </main>
  );
}

function needsFullIndex(filters: UniversityIndexFilters): boolean {
  return (
    filters.q.trim().length > 0 ||
    filters.coverage !== defaultFilters.coverage ||
    filters.order !== defaultFilters.order ||
    filters.ranking !== defaultFilters.ranking ||
    filters.sort !== defaultFilters.sort
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
  coverage: UniversityIndexCoverageFilter,
  locale: SupportedLocale
): RecordWithSelectedRanking[] {
  const normalizedQuery = normalizeForSearch(query);

  return records.filter((record) => {
    if (coverage === "ranked" && !record.selectedRanking) return false;
    if (coverage === "missing" && record.selectedRanking) return false;
    if (!normalizedQuery) return true;

    return [
      record.name,
      getLocalizedInstitutionName(record.slug, record.name, locale),
      ...getInstitutionLocalizedAliasesByLocale(record.slug, locale),
      record.country,
      record.region,
      record.summary
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => textMatchesNormalized(value, normalizedQuery));
  });
}

function sortRecords(
  records: RecordWithSelectedRanking[],
  sortKey: UniversityIndexSortKey,
  sortOrder: UniversityIndexSortOrder,
  locale: SupportedLocale
): RecordWithSelectedRanking[] {
  const direction = sortOrder === "asc" ? 1 : -1;

  return [...records].sort((left, right) => {
    const comparison = compareRecords(left, right, sortKey, locale);
    if (comparison) return comparison * direction;

    return getLocalizedInstitutionName(left.slug, left.name, locale).localeCompare(
      getLocalizedInstitutionName(right.slug, right.name, locale)
    );
  });
}

function compareRecords(
  left: RecordWithSelectedRanking,
  right: RecordWithSelectedRanking,
  sortKey: UniversityIndexSortKey,
  locale: SupportedLocale
): number {
  if (sortKey === "name") {
    return getLocalizedInstitutionName(left.slug, left.name, locale).localeCompare(
      getLocalizedInstitutionName(right.slug, right.name, locale)
    );
  }
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

function renderRanking(
  ranking: CatalogUniversityRanking | undefined,
  copy: ReturnType<typeof getPageCopy>["universities"]
) {
  if (!ranking) return <span className="table-muted">{copy.notIndexed}</span>;

  return (
    <span className="ranking-cell">
      <strong>{ranking.rankText}</strong>
      <span>
        {ranking.rankingYear}
        {ranking.status === "partial" ? ` · ${copy.partialSource}` : ""}
        {ranking.rankType === "derived_metric_order" ? ` · ${copy.derivedOrder}` : ""}
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

function buildFilterUrl(
  filters: UniversityIndexFilters,
  locale: SupportedLocale
): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.ranking !== defaultFilters.ranking) params.set("ranking", filters.ranking);
  if (filters.coverage !== defaultFilters.coverage) {
    params.set("coverage", filters.coverage);
  }
  if (filters.sort !== defaultFilters.sort) params.set("sort", filters.sort);
  if (filters.order !== defaultFilters.order) params.set("order", filters.order);
  const query = params.toString();

  const path = query ? `/universities?${query}` : "/universities";

  return localizeHref(path, locale);
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
