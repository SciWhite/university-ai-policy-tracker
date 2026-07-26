"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent
} from "react";
import { DataList, DataListRow } from "@/components/data-list";
import { DocumentLink as Link } from "@/components/document-link";
import { MetaLabel } from "@/components/meta-label";
import { StateLabel } from "@/components/state-label";
import {
  defaultChangeIndexFilters,
  filterChangeIndexRecords,
  formatChangeReviewStateLabel,
  formatChangeSourceHealthLabel,
  isDefaultChangeIndexFilters,
  normalizeChangeReviewFilter,
  normalizeChangeSortKey,
  normalizeChangeSourceHealthFilter,
  parseChangeIndexFilters,
  summarizeChangeIndexRecords,
  type ChangeIndexFilters,
  type ChangeIndexVisibleSummary
} from "@/lib/change-index-filters";
import type {
  ChangeIndexData,
  ChangeIndexRecord
} from "@/lib/change-records";
import { localizeHref, type SupportedLocale } from "@/lib/i18n";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";
import type { ChangesIndexClientCopy } from "@/lib/page-copy";

type ChangeIndexFacets = ChangeIndexData["data"]["facets"];

interface ChangesIndexClientProps {
  copy: ChangesIndexClientCopy;
  facets: ChangeIndexFacets;
  // NO_ADVICE_BOUNDARY passed from the server page: importing it from
  // @uapt/shared here would pull the whole shared package (zod included)
  // into the client bundle.
  fallbackNotice: string;
  initialRecords: ChangeIndexRecord[];
  locale: SupportedLocale;
  totalSummary: ChangeIndexVisibleSummary;
}

const fullTimelinePath = "/api/public/v1/changes/index.json";

const fullTimelineCopy: Record<SupportedLocale, {
  load: string;
  loading: string;
  loadError: string;
  firstPage: (visible: string, total: string) => string;
}> = {
  en: {
    load: "Load complete timeline",
    loading: "Loading...",
    loadError: "The complete timeline could not be loaded. Public JSON remains available from the changes artifact links.",
    firstPage: (visible, total) => `Showing a fast first page of ${visible} change records. Search, filter, sort, or load the complete timeline to query all ${total} records.`
  },
  zh: {
    load: "加载完整时间线",
    loading: "正在加载…",
    loadError: "无法加载完整时间线。仍可通过变更工件链接访问公共 JSON。",
    firstPage: (visible, total) => `当前快速显示前 ${visible} 条变更记录。搜索、筛选、排序或加载完整时间线，即可查询全部 ${total} 条记录。`
  },
  fr: {
    load: "Charger la chronologie complète",
    loading: "Chargement…",
    loadError: "Impossible de charger la chronologie complète. Le JSON public reste accessible depuis les liens de l’artefact des changements.",
    firstPage: (visible, total) => `Affichage rapide des ${visible} premiers enregistrements de changements. Recherchez, filtrez, triez ou chargez la chronologie complète pour interroger les ${total} enregistrements.`
  },
  pl: {
    load: "Wczytaj pełną oś czasu",
    loading: "Wczytywanie…",
    loadError: "Nie udało się wczytać pełnej osi czasu. Publiczny JSON jest nadal dostępny przez łącza artefaktu zmian.",
    firstPage: (visible, total) => `Wyświetlana jest szybka pierwsza strona obejmująca ${visible} rekordów zmian. Wyszukaj, przefiltruj, posortuj lub wczytaj pełną oś czasu, aby przeglądać wszystkie ${total} rekordów.`
  },
  es: {
    load: "Cargar la cronología completa",
    loading: "Cargando…",
    loadError: "No se pudo cargar la cronología completa. El JSON público sigue disponible desde los enlaces del artefacto de cambios.",
    firstPage: (visible, total) => `Se muestra una primera página rápida de ${visible} registros de cambios. Busca, filtra, ordena o carga la cronología completa para consultar los ${total} registros.`
  },
  nl: {
    load: "Volledige tijdlijn laden",
    loading: "Laden…",
    loadError: "De volledige tijdlijn kon niet worden geladen. De openbare JSON blijft beschikbaar via de artefactlinks van de wijzigingen.",
    firstPage: (visible, total) => `Er wordt een snelle eerste pagina met ${visible} wijzigingsrecords getoond. Zoek, filter, sorteer of laad de volledige tijdlijn om alle ${total} records te doorzoeken.`
  },
  ms: {
    load: "Muatkan garis masa lengkap",
    loading: "Memuatkan…",
    loadError: "Garis masa lengkap tidak dapat dimuatkan. JSON awam masih tersedia melalui pautan artifak perubahan.",
    firstPage: (visible, total) => `Paparan pantas halaman pertama menunjukkan ${visible} rekod perubahan. Cari, tapis, isih atau muatkan garis masa lengkap untuk meneliti kesemua ${total} rekod.`
  }
};

export function ChangesIndexClient({
  copy,
  facets,
  fallbackNotice,
  initialRecords,
  locale,
  totalSummary
}: ChangesIndexClientProps) {
  const timelineCopy = fullTimelineCopy[locale];
  const [filters, setFilters] = useState<ChangeIndexFilters>(
    defaultChangeIndexFilters
  );
  const [records, setRecords] = useState(initialRecords);
  const [hasFullIndex, setHasFullIndex] = useState(false);
  const [isLoadingFullIndex, setIsLoadingFullIndex] = useState(false);
  const [fullIndexError, setFullIndexError] = useState(false);

  const loadFullIndex = useCallback(async () => {
    if (hasFullIndex || isLoadingFullIndex) return;

    setIsLoadingFullIndex(true);
    setFullIndexError(false);

    try {
      const response = await fetch(fullTimelinePath);
      if (!response.ok) throw new Error(`Timeline request failed: ${response.status}`);
      const payload = (await response.json()) as {
        data?: {
          records?: ChangeIndexRecord[];
        };
      };
      const nextRecords = payload.data?.records;
      if (!Array.isArray(nextRecords)) {
        throw new Error("Timeline response did not include records.");
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
      setFilters(parseChangeIndexFilters(new URLSearchParams(window.location.search)));
    };

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);

    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  useEffect(() => {
    if (isDefaultChangeIndexFilters(filters) || hasFullIndex) return;
    void loadFullIndex();
  }, [filters, hasFullIndex, loadFullIndex]);

  const isFiltered = !isDefaultChangeIndexFilters(filters);
  const filteredRecords = useMemo(
    () => filterChangeIndexRecords(records, filters),
    [filters, records]
  );
  const visibleSummary = useMemo(
    () =>
      hasFullIndex || isFiltered
        ? summarizeChangeIndexRecords(filteredRecords)
        : totalSummary,
    [filteredRecords, hasFullIndex, isFiltered, totalSummary]
  );
  const activeFilterSummary = buildActiveFilterSummary(
    filters,
    facets,
    filteredRecords.length,
    totalSummary.recordCount
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.history.pushState({}, "", buildFilterUrl(filters, locale));
  }

  function resetFilters() {
    setFilters(defaultChangeIndexFilters);
    window.history.pushState({}, "", localizeHref("/changes", locale));
  }

  return (
    <>
      <section className="metrics-grid" aria-label={copy.summaryLabel}>
        <div>
          <span>{visibleSummary.recordCount}</span>
          <p>{copy.recordsWithDiffRows}</p>
        </div>
        <div>
          <span>{visibleSummary.policyTextChangedCount}</span>
          <p>{copy.policyTextChanges}</p>
        </div>
        <div>
          <span>{visibleSummary.newlyExtractedClaimsCount}</span>
          <p>{copy.newlyExtractedClaims}</p>
        </div>
        <div>
          <span>{visibleSummary.sourceHealthIssueCount}</span>
          <p>{copy.sourceHealthLabel}</p>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>{copy.filtersTitle}</h2>
        </div>

        <form
          action={localizeHref("/changes", locale)}
          className="university-filter-form"
          method="get"
          onSubmit={handleSubmit}
        >
          <label>
            <span>{copy.searchLabel}</span>
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
            <span>{copy.themeLabel}</span>
            <select
              name="theme"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  theme: event.target.value
                }))
              }
              value={filters.theme}
            >
              <option value="">{copy.allThemes}</option>
              {facets.themes.map((facet) => (
                <option key={facet.theme} value={facet.theme}>
                  {facet.label} ({facet.count})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy.reviewLabel}</span>
            <select
              name="review"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  review: normalizeChangeReviewFilter(event.target.value)
                }))
              }
              value={filters.review}
            >
              <option value="all">{copy.allReviewStates}</option>
              {facets.reviewStates.map((facet) => (
                <option key={facet.reviewState} value={facet.reviewState}>
                  {facet.label} ({facet.count})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy.sourceHealthLabel}</span>
            <select
              name="sourceHealth"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  sourceHealth: normalizeChangeSourceHealthFilter(
                    event.target.value
                  )
                }))
              }
              value={filters.sourceHealth}
            >
              <option value="all">{copy.allSourceHealth}</option>
              {facets.sourceHealth.map((facet) => (
                <option key={facet.severity} value={facet.severity}>
                  {facet.label} ({facet.count})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy.sortLabel}</span>
            <select
              name="sort"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  sort: normalizeChangeSortKey(event.target.value)
                }))
              }
              value={filters.sort}
            >
              <option value="changed">{copy.sortChanged}</option>
              <option value="checked">{copy.sortChecked}</option>
              <option value="claims">{copy.sortClaims}</option>
              <option value="sources">{copy.sortSources}</option>
              <option value="firstSeen">{copy.firstSeen}</option>
            </select>
          </label>
          <button type="submit">{copy.applyFilters}</button>
          <button
            className="filter-reset-link"
            onClick={resetFilters}
            type="button"
          >
            {copy.resetFilters}
          </button>
        </form>

        <p className="table-summary">{activeFilterSummary}</p>
        {!hasFullIndex ? (
          <p className="notice-card">
            {timelineCopy.firstPage(
              records.length.toLocaleString(locale),
              totalSummary.recordCount.toLocaleString(locale)
            )}{" "}
            <button
              className="filter-reset-link"
              disabled={isLoadingFullIndex}
              onClick={() => void loadFullIndex()}
              type="button"
            >
              {isLoadingFullIndex ? timelineCopy.loading : timelineCopy.load}
            </button>
          </p>
        ) : null}
        {fullIndexError ? (
          <p className="notice-card">{timelineCopy.loadError}</p>
        ) : null}
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>{copy.timelineTitle}</h2>
          <p>
            {filteredRecords.length} of {totalSummary.recordCount} change
            records visible. {visibleSummary.policyTextChangedCount} comparable
            policy-text changes, {visibleSummary.newlyExtractedClaimsCount} newly
            extracted claims, and {visibleSummary.sourceSnapshotChangedCount} source
            snapshot changes are currently in view.
          </p>
        </div>

        {filteredRecords.length ? (
          <DataList className="timeline-list">
            {filteredRecords.map((record) => {
              const displayName = getLocalizedInstitutionName(
                record.slug,
                record.name,
                locale
              );
              const primaryDate = record.lastChangedAt ?? record.lastCheckedAt;

              return (
                <DataListRow
                  actions={
                    <>
                      <Link href={record.changeUrl}>
                        {copy.changeDetail}
                      </Link>
                      <Link href={record.universityUrl}>
                        {copy.universityPage}
                      </Link>
                      <a href={record.publicJsonUrl}>{copy.publicJson}</a>
                      <a href={`/api/public/v1/changes/latest/${record.slug}.json`}>
                        {copy.latestDiffJson}
                      </a>
                    </>
                  }
                  className="timeline-list__row"
                  key={record.slug}
                  metadata={
                    <>
                      <StateLabel
                        locale={locale}
                        prefix=""
                        reviewState={record.reviewState}
                      />
                      <MetaLabel label={copy.sourceHealthLabel}>
                        {record.sourceHealthLabel}
                      </MetaLabel>
                      <MetaLabel label={copy.claims}>{record.claimCount}</MetaLabel>
                      <MetaLabel label={copy.sources}>{record.sourceCount}</MetaLabel>
                      <MetaLabel label={copy.firstSeen}>
                        {record.firstSeenAt
                          ? formatDate(record.firstSeenAt, locale)
                          : copy.noPublicDate}
                      </MetaLabel>
                      {record.lastCheckedAt ? (
                        <MetaLabel label={copy.checked}>
                          {formatDate(record.lastCheckedAt, locale)}
                        </MetaLabel>
                      ) : null}
                      {record.lastChangedAt ? (
                        <MetaLabel label={copy.changed}>
                          {formatDate(record.lastChangedAt, locale)}
                        </MetaLabel>
                      ) : null}
                      <MetaLabel label="Releases">{record.releaseCount}</MetaLabel>
                      <MetaLabel label="Themes">
                        {formatThemes(record)}
                      </MetaLabel>
                    </>
                  }
                >
                  <p className="timeline-list__date">
                    {primaryDate ? formatDate(primaryDate, locale) : copy.noPublicDate}
                  </p>
                  <h2 data-i18n="preserve">{displayName}</h2>
                  <p>{record.summary || buildRecordSummary(record, locale)}</p>
                  {record.primaryDiff ? (
                    <div className="change-claim-pair">
                      <div className="change-claim-pair__item">
                        <span className="change-claim-pair__label">
                          {copy.oldClaim}
                        </span>
                        <p className="change-claim-pair__text">
                          {record.primaryDiff.oldClaimText ??
                            record.primaryDiff.changeExplanation}
                        </p>
                      </div>
                      <div className="change-claim-pair__item">
                        <span className="change-claim-pair__label">
                          {copy.newClaim}
                        </span>
                        <p className="change-claim-pair__text">
                          {record.primaryDiff.newClaimText ??
                            record.primaryDiff.changeExplanation}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="notice-card">
                      {record.summary || fallbackNotice}
                    </p>
                  )}
                </DataListRow>
              );
            })}
          </DataList>
        ) : (
          <p className="notice-card">{copy.noChanges}</p>
        )}
      </section>
    </>
  );
}

function buildFilterUrl(
  filters: ChangeIndexFilters,
  locale: SupportedLocale
): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.theme) params.set("theme", filters.theme);
  if (filters.review !== defaultChangeIndexFilters.review) {
    params.set("review", filters.review);
  }
  if (filters.sourceHealth !== defaultChangeIndexFilters.sourceHealth) {
    params.set("sourceHealth", filters.sourceHealth);
  }
  if (filters.sort !== defaultChangeIndexFilters.sort) {
    params.set("sort", filters.sort);
  }
  const query = params.toString();

  return localizeHref(query ? `/changes?${query}` : "/changes", locale);
}

function buildActiveFilterSummary(
  filters: ChangeIndexFilters,
  facets: ChangeIndexFacets,
  visibleRecordCount: number,
  totalRecordCount: number
): string {
  const parts = [
    filters.q ? `query "${filters.q}"` : "",
    filters.theme ? `theme ${getFilterThemeLabel(filters.theme, facets)}` : "",
    filters.review !== "all"
      ? `review ${formatChangeReviewStateLabel(filters.review)}`
      : "",
    filters.sourceHealth !== "all"
      ? `source health ${formatChangeSourceHealthLabel(filters.sourceHealth)}`
      : ""
  ].filter(Boolean);

  return parts.length
    ? `Showing ${visibleRecordCount} of ${totalRecordCount} records filtered by ${parts.join(", ")}.`
    : `Showing ${visibleRecordCount} records.`;
}

function getFilterThemeLabel(
  theme: string,
  facets: ChangeIndexFacets
): string {
  return (
    facets.themes.find((facet) => facet.theme === theme)?.label ?? theme
  );
}

function buildRecordSummary(
  record: ChangeIndexRecord,
  locale: SupportedLocale
): string {
  const displayName = getLocalizedInstitutionName(record.slug, record.name, locale);
  const changedText = record.lastChangedAt
    ? `Latest tracked change on ${formatDate(record.lastChangedAt, locale)}.`
    : "No public changed date has been published yet.";
  return `${displayName} has ${record.claimCount} source-backed claim records and ${record.sourceCount} official source attributions. ${changedText}`;
}

function formatThemes(record: ChangeIndexRecord): string {
  const labels = record.themes.slice(0, 3).map((theme) => theme.label);
  if (!labels.length) return "Unclassified";
  if (record.themes.length > labels.length) {
    labels.push(`+${record.themes.length - labels.length}`);
  }
  return labels.join(", ");
}

function formatDate(value: string, locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}
