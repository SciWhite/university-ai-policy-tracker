import Link from "next/link";
import { PUBLIC_API_VERSION, NO_ADVICE_BOUNDARY } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { CitationCopyActions } from "@/components/citation-copy-actions";
import { DataList, DataListRow } from "@/components/data-list";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import {
  getChangeIndexData,
  type ChangeIndexRecord,
  type ChangeIndexSourceHealthSeverity
} from "@/lib/change-records";
import { normalizeForSearch, textMatchesNormalized } from "@/lib/search-text";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { localizeHref, normalizeLocale, type SupportedLocale } from "@/lib/i18n";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";
import { getPageCopy } from "@/lib/page-copy";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

interface ChangesPageProps {
  params?: Promise<{
    locale?: string;
  }>;
  searchParams?: Promise<{
    q?: string;
    review?: string;
    sort?: string;
    sourceHealth?: string;
    theme?: string;
  }>;
}

interface ChangesSearchParams {
  q?: string;
  review?: string;
  sort?: string;
  sourceHealth?: string;
  theme?: string;
}

type ChangeSortKey = "changed" | "checked" | "claims" | "sources" | "firstSeen";
type ChangeReviewFilter = "all" | "agent_reviewed" | "human_reviewed" | "machine_candidate" | "needs_review" | "rejected";
type ChangeSourceHealthFilter =
  | "all"
  | ChangeIndexSourceHealthSeverity;

interface ParsedChangeFilters {
  q: string;
  review: ChangeReviewFilter;
  sort: ChangeSortKey;
  sourceHealth: ChangeSourceHealthFilter;
  theme: string;
}

const DEFAULT_SORT: ChangeSortKey = "changed";

export async function generateMetadata({
  params
}: ChangesPageProps = {}) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).changes;
  const alternates = getLocalizedAlternates("/changes", locale);
  const canonical = String(alternates.canonical);

  return {
    title: copy.title,
    description: copy.description,
    alternates,
    openGraph: {
      title: copy.title,
      description: copy.description,
      url: canonical,
      type: "website"
    }
  };
}

export const dynamic = "force-dynamic";

export default async function ChangesPage({ params, searchParams }: ChangesPageProps) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).changes;
  const index = await getChangeIndexData();
  const filters = parseFilters((await searchParams) ?? {});
  const filteredRecords = filterRecords(index.data.records, filters);
  const canonical = getAbsoluteSiteUrl(localizeHref("/changes", locale));
  const publicJsonUrl = index.publicJsonUrl;
  const citationText = `University AI Policy Tracker changes index. University AI Policy Tracker. Version v1. ${canonical}`;
  const visibleSummary = summarizeRecords(filteredRecords);
  const activeFilterSummary = buildActiveFilterSummary(
    filters,
    copy,
    index,
    filteredRecords.length
  );

  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: copy.title,
          description: copy.description,
          url: canonical,
          isPartOf: {
            "@type": "WebSite",
            name: "University AI Policy Tracker",
            url: getAbsoluteSiteUrl("/")
          },
          mainEntity: {
            "@type": "ItemList",
            name: "University AI policy change timeline",
            numberOfItems: filteredRecords.length,
            itemListElement: filteredRecords.slice(0, 10).map((record, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: getAbsoluteSiteUrl(localizeHref(record.changeUrl, locale)),
              name: getLocalizedInstitutionName(record.slug, record.name, locale)
            }))
          }
        }}
      />

      <section className="hero">
        <p className="kicker">{copy.kicker}</p>
        <h1>{copy.heading}</h1>
        <p className="lead">{copy.lead}</p>
      </section>

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

      <section className="answer-strip" aria-label={copy.answersLabel}>
        {copy.answers.map((answer) => (
          <article className="answer-card" key={answer.title}>
            <h2>{answer.title}</h2>
            <p>{answer.text}</p>
          </article>
        ))}
      </section>

      <ReferenceBox
        className="compact-reference-box"
        description={copy.artifactDescription}
        title={copy.artifactTitle}
        actions={
          <CitationCopyActions
            canonicalUrl={canonical}
            citationText={citationText}
            publicJsonUrl={publicJsonUrl}
          />
        }
      >
        <p>{copy.indexJsonDescription}</p>
        <ApiEndpointRow
          description={copy.indexJsonDescription}
          label={copy.indexJson}
          path="/api/public/v1/changes/index.json"
          url={publicJsonUrl}
        />
        <ApiEndpointRow
          description={copy.recentChangesJsonDescription}
          label={copy.recentChangesJson}
          path={`/api/public/${PUBLIC_API_VERSION}/recent-changes.json`}
          url={getAbsoluteSiteUrl(
            `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`
          )}
        />
        <ApiEndpointRow
          description={copy.latestDiffJsonDescription}
          label={copy.latestDiffJson}
          path={`/api/public/${PUBLIC_API_VERSION}/changes/latest.json`}
          url={getAbsoluteSiteUrl(
            `/api/public/${PUBLIC_API_VERSION}/changes/latest.json`
          )}
        />
      </ReferenceBox>

      <section className="section">
        <div className="section-heading">
          <h2>{copy.filtersTitle}</h2>
          <p>{copy.filtersLead}</p>
        </div>

        <form
          action={localizeHref("/changes", locale)}
          className="university-filter-form"
          method="get"
        >
          <label>
            <span>{copy.searchLabel}</span>
            <input
              defaultValue={filters.q}
              name="q"
              placeholder={copy.searchPlaceholder}
              type="search"
            />
          </label>
          <label>
            <span>{copy.themeLabel}</span>
            <select defaultValue={filters.theme} name="theme">
              <option value="">{copy.allThemes}</option>
              {index.data.facets.themes.map((facet) => (
                <option key={facet.theme} value={facet.theme}>
                  {facet.label} ({facet.count})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy.reviewLabel}</span>
            <select defaultValue={filters.review} name="review">
              <option value="all">{copy.allReviewStates}</option>
              {index.data.facets.reviewStates.map((facet) => (
                <option key={facet.reviewState} value={facet.reviewState}>
                  {facet.label} ({facet.count})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy.sourceHealthLabel}</span>
            <select defaultValue={filters.sourceHealth} name="sourceHealth">
              <option value="all">{copy.allSourceHealth}</option>
              {index.data.facets.sourceHealth.map((facet) => (
                <option key={facet.severity} value={facet.severity}>
                  {facet.label} ({facet.count})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy.sortLabel}</span>
            <select defaultValue={filters.sort} name="sort">
              <option value="changed">{copy.sortChanged}</option>
              <option value="checked">{copy.sortChecked}</option>
              <option value="claims">{copy.sortClaims}</option>
              <option value="sources">{copy.sortSources}</option>
              <option value="firstSeen">{copy.firstSeen}</option>
            </select>
          </label>
          <button type="submit">{copy.applyFilters}</button>
          <Link className="filter-reset-link" href={localizeHref("/changes", locale)}>
            {copy.resetFilters}
          </Link>
        </form>

        <p className="table-summary">{activeFilterSummary}</p>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>{copy.timelineTitle}</h2>
          <p>
            {filteredRecords.length} of {index.data.summary.recordCount} change
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
                      <Link href={localizeHref(record.changeUrl, locale)}>
                        {copy.changeDetail}
                      </Link>
                      <Link href={localizeHref(record.universityUrl, locale)}>
                        {copy.universityPage}
                      </Link>
                      <a href={record.publicJsonUrl}>{copy.publicJson}</a>
                      <a
                        href={getAbsoluteSiteUrl(
                          `/api/public/${PUBLIC_API_VERSION}/changes/latest/${record.slug}.json`
                        )}
                      >
                        {copy.latestDiffJson}
                      </a>
                    </>
                  }
                  className="timeline-list__row"
                  key={record.slug}
                  metadata={
                    <>
                      <StateLabel prefix="" reviewState={record.reviewState} />
                      <MetaLabel label={copy.sourceHealthLabel}>
                        {record.sourceHealthLabel}
                      </MetaLabel>
                      <MetaLabel label={copy.claims}>{record.claimCount}</MetaLabel>
                      <MetaLabel label={copy.sources}>{record.sourceCount}</MetaLabel>
                      <MetaLabel label={copy.firstSeen}>
                        {record.firstSeenAt
                          ? formatDate(record.firstSeenAt)
                          : copy.noPublicDate}
                      </MetaLabel>
                      {record.lastCheckedAt ? (
                        <MetaLabel label={copy.checked}>
                          {formatDate(record.lastCheckedAt)}
                        </MetaLabel>
                      ) : null}
                      {record.lastChangedAt ? (
                        <MetaLabel label={copy.changed}>
                          {formatDate(record.lastChangedAt)}
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
                    {primaryDate ? formatDate(primaryDate) : copy.noPublicDate}
                  </p>
                  <h2>{displayName}</h2>
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
                      {record.summary || NO_ADVICE_BOUNDARY}
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

      <section className="section">
        <div className="section-heading">
          <h2>{copy.boundaryTitle}</h2>
          <p>{copy.boundaryLead}</p>
        </div>
        <p className="notice-card">{NO_ADVICE_BOUNDARY}</p>
      </section>
    </main>
  );
}

function parseFilters(searchParams: ChangesSearchParams): ParsedChangeFilters {
  const resolved = searchParams ?? {};
  const q = normalizeString(getFirstValue(resolved.q));
  const review = normalizeReviewFilter(getFirstValue(resolved.review));
  const sort = normalizeSortKey(getFirstValue(resolved.sort));
  const sourceHealth = normalizeSourceHealthFilter(getFirstValue(resolved.sourceHealth));
  const theme = normalizeString(getFirstValue(resolved.theme));

  return { q, review, sort, sourceHealth, theme };
}

function filterRecords(
  records: ChangeIndexRecord[],
  filters: ParsedChangeFilters
): ChangeIndexRecord[] {
  const normalizedQuery = normalizeForSearch(filters.q);

  return records
    .filter((record) => {
      if (filters.review !== "all" && record.reviewState !== filters.review) {
        return false;
      }

      if (filters.sourceHealth !== "all" && record.sourceHealth !== filters.sourceHealth) {
        return false;
      }

      if (
        filters.theme &&
        !record.themes.some((theme) => theme.theme === filters.theme)
      ) {
        return false;
      }

      if (!normalizedQuery) return true;

      const searchable = [
        record.name,
        record.summary,
        record.sourceHealthLabel,
        record.themes.map((theme) => theme.label).join(" "),
        record.primaryDiff?.changeExplanation,
        record.primaryDiff?.oldClaimText,
        record.primaryDiff?.newClaimText
      ]
        .filter((value): value is string => Boolean(value))
        .join(" ");

      return textMatchesNormalized(searchable, normalizedQuery);
    })
    .sort((left, right) => compareRecords(left, right, filters.sort));
}

function compareRecords(
  left: ChangeIndexRecord,
  right: ChangeIndexRecord,
  sort: ChangeSortKey
): number {
  switch (sort) {
    case "checked":
      return compareDate(
        right.lastCheckedAt ?? right.lastChangedAt ?? right.firstSeenAt,
        left.lastCheckedAt ?? left.lastChangedAt ?? left.firstSeenAt
      );
    case "claims":
      return (
        right.claimCount - left.claimCount ||
        compareDate(
          right.lastChangedAt ?? right.lastCheckedAt ?? right.firstSeenAt,
          left.lastChangedAt ?? left.lastCheckedAt ?? left.firstSeenAt
        )
      );
    case "sources":
      return (
        right.sourceCount - left.sourceCount ||
        compareDate(
          right.lastChangedAt ?? right.lastCheckedAt ?? right.firstSeenAt,
          left.lastChangedAt ?? left.lastCheckedAt ?? left.firstSeenAt
        )
      );
    case "firstSeen":
      return compareDate(right.firstSeenAt, left.firstSeenAt);
    case "changed":
    default:
      return compareDate(
        right.lastChangedAt ?? right.lastCheckedAt ?? right.firstSeenAt,
        left.lastChangedAt ?? left.lastCheckedAt ?? left.firstSeenAt
      );
  }
}

function compareDate(left?: string, right?: string): number {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;
  return leftTime - rightTime;
}

function summarizeRecords(records: ChangeIndexRecord[]) {
  return {
    claimCount: records.reduce((total, record) => total + record.claimCount, 0),
    newlyExtractedClaimsCount: records.reduce(
      (total, record) => total + record.newlyExtractedClaims,
      0
    ),
    policyTextChangedCount: records.reduce(
      (total, record) => total + record.policyTextChanged,
      0
    ),
    recordCount: records.length,
    reviewedClaimCount: records.reduce(
      (total, record) => total + record.reviewedClaimCount,
      0
    ),
    sourceHealthIssueCount: records.filter(
      (record) => record.sourceHealth !== "healthy"
    ).length,
    sourceSnapshotChangedCount: records.reduce(
      (total, record) => total + record.sourceSnapshotChanged,
      0
    ),
    sourceTextChangedCount: records.reduce(
      (total, record) => total + record.sourceTextChanged,
      0
    )
  };
}

function buildActiveFilterSummary(
  filters: ParsedChangeFilters,
  copy: ReturnType<typeof getPageCopy>["changes"],
  index: Awaited<ReturnType<typeof getChangeIndexData>>,
  visibleRecordCount: number
): string {
  const parts = [
    filters.q ? `query "${filters.q}"` : "",
    filters.theme ? `theme ${getFilterThemeLabel(filters.theme, index)}` : "",
    filters.review !== "all" ? `review ${formatReviewStateLabel(filters.review)}` : "",
    filters.sourceHealth !== "all"
      ? `source health ${formatSourceHealthLabel(filters.sourceHealth)}`
      : ""
  ].filter(Boolean);

  return parts.length
    ? `Showing ${visibleRecordCount} of ${index.data.summary.recordCount} records filtered by ${parts.join(", ")}.`
    : `Showing ${index.data.records.length} records. ${copy.filtersLead}`;
}

function buildRecordSummary(record: ChangeIndexRecord, locale: SupportedLocale): string {
  const displayName = getLocalizedInstitutionName(record.slug, record.name, locale);
  const changedText = record.lastChangedAt
    ? `Latest tracked change on ${formatDate(record.lastChangedAt)}.`
    : "No public changed date has been published yet.";
  return `${displayName} has ${record.claimCount} source-backed claim records and ${record.sourceCount} official source attributions. ${changedText}`;
}

function getFilterThemeLabel(
  theme: string,
  index: Awaited<ReturnType<typeof getChangeIndexData>>
): string {
  return (
    index.data.facets.themes.find((facet) => facet.theme === theme)?.label ??
    theme
  );
}

function formatThemes(record: ChangeIndexRecord): string {
  const labels = record.themes.slice(0, 3).map((theme) => theme.label);
  if (!labels.length) return "Unclassified";
  if (record.themes.length > labels.length) {
    labels.push(`+${record.themes.length - labels.length}`);
  }
  return labels.join(", ");
}

function formatReviewStateLabel(reviewState: string): string {
  switch (reviewState) {
    case "agent_reviewed":
      return "Agent reviewed";
    case "human_reviewed":
      return "Human reviewed";
    case "machine_candidate":
      return "Machine candidate";
    case "needs_review":
      return "Needs review";
    case "rejected":
      return "Rejected";
    default:
      return reviewState;
  }
}

function formatSourceHealthLabel(value: string): string {
  switch (value) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Warning";
    case "error":
      return "Error";
    case "unknown":
      return "Unknown";
    default:
      return value;
  }
}

function normalizeSortKey(value: string | undefined): ChangeSortKey {
  switch (normalizeString(value)) {
    case "checked":
    case "claims":
    case "sources":
    case "firstSeen":
      return normalizeString(value) as ChangeSortKey;
    case "changed":
    default:
      return DEFAULT_SORT;
  }
}

function normalizeReviewFilter(value: string | undefined): ChangeReviewFilter {
  switch (normalizeString(value)) {
    case "agent_reviewed":
    case "human_reviewed":
    case "machine_candidate":
    case "needs_review":
    case "rejected":
      return normalizeString(value) as ChangeReviewFilter;
    default:
      return "all";
  }
}

function normalizeSourceHealthFilter(
  value: string | undefined
): ChangeSourceHealthFilter {
  switch (normalizeString(value)) {
    case "healthy":
    case "warning":
    case "error":
    case "unknown":
      return normalizeString(value) as ChangeSourceHealthFilter;
    default:
      return "all";
  }
}

function normalizeString(value: string | undefined): string {
  return value?.trim() ?? "";
}

function getFirstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}
