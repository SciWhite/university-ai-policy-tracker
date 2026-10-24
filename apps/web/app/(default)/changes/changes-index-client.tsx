"use client";

import { changeSummaryText } from "@/lib/localized-change-summary";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DocumentLink as Link } from "@/components/document-link";
import { UniversityMark } from "@/components/university-mark";
import { StateLabel, getReviewStateLabel } from "@/components/state-label";
import {
  DiscoveryEmpty,
  DiscoveryIcon,
  DiscoveryLoadState,
  DiscoveryPagination,
  useDiscoveryRecords,
} from "@/components/discovery-ui";
import { discoveryCopy, discoveryTopicLabel } from "@/lib/discovery-copy";
import {
  defaultChangeIndexFilters,
  filterChangeIndexRecords,
  parseChangeIndexFilters,
  type ChangeIndexFilters,
  type ChangeIndexVisibleSummary,
} from "@/lib/change-index-filters";
import type { ChangeIndexData, ChangeIndexRecord } from "@/lib/change-records";
import { localizeHref, type SupportedLocale } from "@/lib/i18n";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";
import type { ChangesIndexClientCopy } from "@/lib/page-copy";
import { formatDateMedium } from "@/lib/format-date";
import { mockupCopy } from "@/lib/mockup-copy";
import { normalizeForSearch, textMatchesNormalized } from "@/lib/search-text";

type Extra = {
  kind: string;
  from: string;
  to: string;
  page: number;
  selected: string;
};
const emptyExtra: Extra = { kind: "", from: "", to: "", page: 1, selected: "" };
type Kind =
  | "correction"
  | "policyText"
  | "sourceUpdate"
  | "claimUpdate"
  | "recordUpdate";
export function getDiscoveryChangeKind(record: ChangeIndexRecord): Kind {
  if (record.publicationKind === "scoped_record_correction")
    return "correction";
  if (record.policyTextChanged > 0) return "policyText";
  if (
    record.sourceTextChanged ||
    record.sourceSnapshotChanged ||
    record.sourceAdded ||
    record.sourceRemoved
  )
    return "sourceUpdate";
  if (
    record.newlyExtractedClaims ||
    record.claimMetadataChanged ||
    record.trackerRemovedClaims
  )
    return "claimUpdate";
  return "recordUpdate";
}
function date(record: ChangeIndexRecord) {
  return record.lastChangedAt ?? record.lastCheckedAt ?? record.firstSeenAt;
}
function parseExtra(p: URLSearchParams): Extra {
  return {
    kind: [
      "correction",
      "policyText",
      "sourceUpdate",
      "claimUpdate",
      "recordUpdate",
    ].includes(p.get("kind") ?? "")
      ? p.get("kind")!
      : "",
    from: /^\d{4}-\d{2}-\d{2}$/.test(p.get("from") ?? "") ? p.get("from")! : "",
    to: /^\d{4}-\d{2}-\d{2}$/.test(p.get("to") ?? "") ? p.get("to")! : "",
    page: Math.max(1, Math.min(10000, Number(p.get("page")) || 1)),
    selected: p.get("selected") ?? "",
  };
}

export function ChangesIndexClient({
  copy: oldCopy,
  facets,
  initialRecords,
  locale,
  totalSummary,
  children,
}: {
  copy: ChangesIndexClientCopy;
  facets: ChangeIndexData["data"]["facets"];
  fallbackNotice?: string;
  initialRecords: ChangeIndexRecord[];
  locale: SupportedLocale;
  totalSummary: ChangeIndexVisibleSummary;
  children?: ReactNode;
}) {
  const copy = discoveryCopy(locale);
  const design = mockupCopy(locale);
  const [filters, setFilters] = useState(defaultChangeIndexFilters);
  const [extra, setExtra] = useState(emptyExtra);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const data = useDiscoveryRecords(
    initialRecords,
    "/api/public/v1/changes/index.json",
    totalSummary.recordCount,
  );
  useEffect(() => {
    const sync = () => {
      const p = new URLSearchParams(window.location.search);
      setFilters(parseChangeIndexFilters(p));
      setExtra(parseExtra(p));
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const needsAll = Boolean(
    filters.q ||
      filters.theme ||
      filters.review !== "all" ||
      filters.sourceHealth !== "all" ||
      filters.sort !== "changed" ||
      extra.kind ||
      extra.from ||
      extra.to ||
      extra.page > 1,
  );
  useEffect(() => {
    if (needsAll && !data.full && !data.error) void data.load();
  }, [needsAll, data.full, data.error, data.load]);
  const rows = useMemo(() => {
    const query = normalizeForSearch(filters.q);
    return filterChangeIndexRecords(data.records, { ...filters, q: "" }).filter(
      (r) => {
        if (
          query &&
          !textMatchesNormalized(
            [
              r.name,
              getLocalizedInstitutionName(r.slug, r.name, locale),
              r.summary,
              r.changeSummary,
              r.primaryDiff?.changeExplanation,
              r.primaryDiff?.oldClaimText,
              r.primaryDiff?.newClaimText,
            ]
              .filter(Boolean)
              .join(" "),
            query,
          )
        )
          return false;
        if (extra.kind && getDiscoveryChangeKind(r) !== extra.kind)
          return false;
        const day = date(r)?.slice(0, 10);
        return (
          (!extra.from || Boolean(day && day >= extra.from)) &&
          (!extra.to || Boolean(day && day <= extra.to))
        );
      },
    );
  }, [data.records, filters, extra.kind, extra.from, extra.to, locale]);
  const count =
    !data.full && !needsAll ? totalSummary.recordCount : rows.length;
  const pageCount = Math.max(1, Math.ceil(count / 8));
  const page = Math.min(extra.page, pageCount);
  const visible = rows.slice((page - 1) * 8, page * 8);
  const selected = visible.find((r) => r.slug === extra.selected) ?? visible[0];
  function update(
    patch: Partial<ChangeIndexFilters>,
    more: Partial<Extra> = {},
  ) {
    const f = { ...filters, ...patch };
    const x = { ...extra, ...more, page: more.page ?? 1 };
    setFilters(f);
    setExtra(x);
    const p = new URLSearchParams();
    for (const key of ["q", "review", "sourceHealth", "theme", "sort"] as const)
      if (f[key] && f[key] !== defaultChangeIndexFilters[key])
        p.set(key, f[key]);
    for (const key of ["kind", "from", "to", "selected"] as const)
      if (x[key]) p.set(key, x[key]);
    if (x.page > 1) p.set("page", String(x.page));
    window.history.pushState(
      null,
      "",
      localizeHref(`/changes${p.size ? `?${p}` : ""}`, locale),
    );
  }
  function reset() {
    update({ ...defaultChangeIndexFilters }, { ...emptyExtra });
  }
  return (
    <div data-discovery-ready={data.ready}>
      <div className="discovery-boundary">
        <p>{copy.changeBoundary}</p>
        {children}
      </div>
      <button
        className="discovery-change-toggle"
        type="button"
        aria-expanded={filtersOpen}
        aria-controls="change-filter-controls"
        onClick={() => setFiltersOpen(!filtersOpen)}
      >
        <DiscoveryIcon name="filter" />
        <span>{copy.filters}</span>
        <span aria-hidden="true">{filtersOpen ? "−" : "+"}</span>
      </button>
      <form
        action={localizeHref("/changes", locale)}
        method="get"
        onSubmit={(e) => {
          e.preventDefault();
          if (!data.full) void data.load();
        }}
      >
        <div
          id="change-filter-controls"
          className={`discovery-change-controls${filtersOpen ? " is-open" : ""}`}
        >
          <div className="discovery-change-filters">
            <label className="discovery-field">
              {copy.search}
              <div className="discovery-search-field">
                <DiscoveryIcon name="search" />
                <input
                  name="q"
                  type="search"
                  placeholder={copy.universitySearch}
                  value={filters.q}
                  onChange={(e) => update({ q: e.target.value })}
                />
              </div>
            </label>
            <label className="discovery-field">
              {copy.changeType}
              <select
                name="kind"
                value={extra.kind}
                onChange={(e) => update({}, { kind: e.target.value })}
              >
                <option value="">{copy.allChanges}</option>
                {(
                  [
                    "correction",
                    "policyText",
                    "sourceUpdate",
                    "claimUpdate",
                    "recordUpdate",
                  ] as Kind[]
                ).map((k) => (
                  <option key={k} value={k}>
                    {copy[k]}
                  </option>
                ))}
              </select>
            </label>
            <details className="discovery-date-range">
              <summary>{design.dateRange}</summary>
              <div>
                {" "}
                <label className="discovery-field">
                  {copy.from}
                  <input
                    type="date"
                    name="from"
                    value={extra.from}
                    max={extra.to || undefined}
                    onChange={(e) => update({}, { from: e.target.value })}
                  />
                </label>
                <label className="discovery-field">
                  {copy.to}
                  <input
                    type="date"
                    name="to"
                    value={extra.to}
                    min={extra.from || undefined}
                    onChange={(e) => update({}, { to: e.target.value })}
                  />
                </label>
              </div>
            </details>{" "}
            <label className="discovery-field">
              {copy.sort}
              <select
                name="sort"
                value={filters.sort}
                onChange={(e) =>
                  update({ sort: e.target.value as ChangeIndexFilters["sort"] })
                }
              >
                <option value="changed">{copy.mostRecent}</option>
                <option value="checked">{copy.checked}</option>
                <option value="claims">{copy.mostClaims}</option>
                <option value="sources">{copy.mostSources}</option>
                <option value="firstSeen">{oldCopy.firstSeen}</option>
              </select>
            </label>
          </div>
        </div>
      </form>
      <DiscoveryLoadState
        locale={locale}
        loading={data.loading}
        error={data.error}
        partial={false}
        onLoad={() => void data.load()}
      />
      {visible.length ? (
        <section
          className="discovery-timeline-layout"
          aria-label={copy.timeline}
          aria-busy={data.loading}
        >
          <ol className="discovery-timeline-list">
            {visible.map((r) => {
              const selectedRow = selected?.slug === r.slug;
              const name = getLocalizedInstitutionName(r.slug, r.name, locale);
              const updated = date(r);
              return (
                <li className="discovery-timeline-row" key={r.slug}>
                  <time dateTime={updated}>
                    {updated ? formatDateMedium(updated, locale) : copy.noDate}
                  </time>
                  <article
                    className={`discovery-timeline-card${selectedRow ? " is-selected" : ""}`}
                  >
                    <div className="discovery-timeline-identity">
                      <UniversityMark slug={r.slug} />
                      <div>
                        <h3>
                          <Link href={r.changeUrl}>{name}</Link>
                        </h3>
                        <span className="discovery-change-kind">
                          {copy[getDiscoveryChangeKind(r)]}
                        </span>
                      </div>
                    </div>
                    <ChangeSummary record={r} locale={locale} />
                    <div className="discovery-actions">
                      <button
                        className="discovery-text-button"
                        type="button"
                        aria-pressed={selectedRow}
                        onClick={() => update({}, { selected: r.slug, page })}
                      >
                        {copy.preview}
                      </button>
                      <Link href={r.universityUrl}>{copy.viewGuide}</Link>
                    </div>
                    {selectedRow ? (
                      <div className="discovery-timeline-inline">
                        <ChangePreview record={r} locale={locale} />
                      </div>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ol>
          <aside className="discovery-timeline-aside" aria-live="polite">
            {selected ? (
              <ChangePreview record={selected} locale={locale} />
            ) : null}
          </aside>
        </section>
      ) : !data.loading ? (
        <DiscoveryEmpty locale={locale} onReset={reset} />
      ) : null}
      <DiscoveryPagination
        locale={locale}
        page={page}
        pageCount={pageCount}
        onPage={(p) => update({}, { page: p, selected: "" })}
      />
      <details className="discovery-change-more">
        <summary>{copy.moreFilters}</summary>
        <div>
          <label className="discovery-field">
            {oldCopy.themeLabel}
            <select
              value={filters.theme}
              onChange={(e) => update({ theme: e.target.value })}
            >
              <option value="">{copy.allTopics}</option>
              {facets.themes.map((t) => (
                <option value={t.theme} key={t.theme}>
                  {discoveryTopicLabel(t.theme, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="discovery-field">
            {oldCopy.reviewLabel}
            <select
              value={filters.review}
              onChange={(e) =>
                update({
                  review: e.target.value as ChangeIndexFilters["review"],
                })
              }
            >
              <option value="all">{oldCopy.allReviewStates}</option>
              {facets.reviewStates.map((r) => (
                <option key={r.reviewState} value={r.reviewState}>
                  {getReviewStateLabel(r.reviewState, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="discovery-field">
            {oldCopy.sourceHealthLabel}
            <select
              value={filters.sourceHealth}
              onChange={(e) =>
                update({
                  sourceHealth: e.target
                    .value as ChangeIndexFilters["sourceHealth"],
                })
              }
            >
              <option value="all">{oldCopy.allSourceHealth}</option>
              {facets.sourceHealth.map((r) => (
                <option key={r.severity} value={r.severity}>
                  {copy[r.severity]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>{" "}
      <div className="discovery-result-toolbar">
        <p className="discovery-muted" aria-live="polite">
          {copy.showing} {visible.length ? (page - 1) * 8 + 1 : 0}–
          {Math.min(page * 8, rows.length)} {copy.of}{" "}
          {count.toLocaleString(locale)}
        </p>
        <button className="discovery-text-button" type="button" onClick={reset}>
          {copy.reset}
        </button>
      </div>
    </div>
  );
}

function ChangePreview({
  record: r,
  locale,
}: {
  record: ChangeIndexRecord;
  locale: SupportedLocale;
}) {
  const copy = discoveryCopy(locale);
  const design = mockupCopy(locale);
  // The v1 index omits Claim IDs and match evidence; use the verified history
  // page for text comparisons instead of pairing unverified cached prose.
  return (
    <div className="discovery-change-preview">
      <h2>{copy.whatChanged}</h2>
      <div className="discovery-timeline-identity">
        <UniversityMark slug={r.slug} />
        <div>
          <h3>{getLocalizedInstitutionName(r.slug, r.name, locale)}</h3>
          <p className="discovery-preview-date">
            {date(r) ? (
              <time dateTime={date(r)}>
                {formatDateMedium(date(r)!, locale)}
              </time>
            ) : null}
            <span className="discovery-change-kind">
              {copy[getDiscoveryChangeKind(r)]}
            </span>
          </p>
        </div>
      </div>
      <ChangeSummary record={r} locale={locale} />
      <dl className="discovery-change-stats">
        <div>
          <dt>{design.recordText}</dt>
          <dd>{copy[getDiscoveryChangeKind(r)]}</dd>
        </div>
        <div>
          <dt>{design.evidenceRefs}</dt>
          <dd>{r.evidenceChanged.toLocaleString(locale)}</dd>
        </div>
        <div>
          <dt>{design.sourceVersions}</dt>
          <dd>
            {r.sourceSnapshotChanged.toLocaleString(locale)} {copy.sources}
          </dd>
        </div>
      </dl>
      <p className="discovery-muted">{copy.noComparison}</p>
      <div className="discovery-actions">
        <Link className="discovery-outline-link" href={r.changeUrl}>
          {copy.viewChanges}
          <DiscoveryIcon name="arrow" />
        </Link>
        <Link href={`${r.universityUrl}#sources`}>
          {copy.officialSources} ↗
        </Link>
        <Link href={r.changeUrl}>{design.history}</Link>
      </div>
      <details className="discovery-data">
        <summary>{copy.data}</summary>
        <div className="discovery-data-body">
          <StateLabel locale={locale} reviewState={r.reviewState} />
          <p className="discovery-muted">
            {copy.version}:{" "}
            <span data-i18n="preserve">{r.releaseId ?? "—"}</span>
          </p>
          <div className="discovery-actions">
            <a href={r.publicJsonUrl}>JSON</a>
            <a href={`/api/public/v1/changes/latest/${r.slug}.json`}>
              Diff JSON
            </a>
          </div>
        </div>
      </details>
    </div>
  );
}

function ChangeSummary({ record, locale }: { record: ChangeIndexRecord; locale: SupportedLocale }) {
  const summary = changeSummaryText(record.changeSummary ?? record.primaryDiff?.changeExplanation ?? record.summary, locale);
  if (!summary) return null;
  return <><p data-i18n="preserve" lang={summary.language}>{summary.text}</p>
    {summary.language === "en" && locale !== "en" ? <p className="discovery-muted">{discoveryCopy(locale).summaryFallback}</p> : null}</>;
}
