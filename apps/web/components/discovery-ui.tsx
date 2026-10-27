"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DocumentLink as Link } from "./document-link";
import { rankingBrowserCopy } from "@/lib/ranking-browser-copy";
import { UniversityMark } from "./university-mark";
import { mockupCopy } from "@/lib/mockup-copy";
import { discoveryPrimaryTopics } from "@/lib/discovery-topic-groups";
import { discoveryTopicLabel } from "@/lib/discovery-copy";
import { discoveryCopy } from "@/lib/discovery-copy";
import { formatDateMedium } from "@/lib/format-date";
import type { SupportedLocale } from "@/lib/i18n";
import { publishedV6Slugs } from "@/lib/policy-v6-published-gate";
import type { DiscoveryUniversity } from "@/lib/discovery-types";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";

export function DiscoveryIcon({
  name,
}: {
  name:
    | "search"
    | "filter"
    | "grid"
    | "list"
    | "arrow"
    | "close"
    | "document"
    | "shield"
    | "laptop"
    | "rss";
}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "rss" ? (
        <>
          <path d="M5 4a15 15 0 0 1 15 15M5 10a9 9 0 0 1 9 9" />
          <circle cx="6" cy="18" r="1.5" />
        </>
      ) : name === "document" ? (
        <>
          <path d="M14 3H6v18h12V7Z" />
          <path d="M14 3v5h4M9 12h6M9 16h6" />
        </>
      ) : name === "shield" ? (
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />
      ) : name === "laptop" ? (
        <>
          <path d="M4 5h16v13H4Z" />
          <path d="M2 20h20" />
        </>
      ) : name === "search" ? (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 5 5" />
        </>
      ) : name === "filter" ? (
        <>
          <path d="M4 7h16M7 12h10M10 17h4" />
        </>
      ) : name === "grid" ? (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </>
      ) : name === "list" ? (
        <>
          <path d="M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01" />
        </>
      ) : name === "close" ? (
        <path d="m6 6 12 12M18 6 6 18" />
      ) : (
        <path d="M4 12h16m-6-6 6 6-6 6" />
      )}
    </svg>
  );
}

export function DiscoveryFilters({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <aside className={`discovery-filters${open ? " is-open" : ""}`}>
      <button
        className="discovery-filter-toggle"
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <DiscoveryIcon name="filter" />
        <span>{title}</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <h2 className="discovery-filter-heading">{title}</h2>
      <div className="discovery-filter-fields" id={id}>
        {children}
      </div>
    </aside>
  );
}

export function DiscoveryUniversityCard({
  record,
  locale,
  selected,
  compareDisabled,
  onCompare,
  analyticsSource,
  featured = false,
  showDate = true,
  returnTo,
}: {
  record: DiscoveryUniversity;
  locale: SupportedLocale;
  selected?: boolean;
  compareDisabled?: boolean;
  onCompare?: () => void;
  analyticsSource?: string;
  featured?: boolean;
  showDate?: boolean;
  returnTo?: string;
}) {
  const copy = discoveryCopy(locale);
  const name = getLocalizedInstitutionName(record.slug, record.name, locale);
  return (
    <article
      className={`discovery-university-card${featured ? " discovery-university-card--featured" : ""}`}
      data-university={record.slug}
    >
      {onCompare ? (
        <label className="discovery-card-check">
          <input
            type="checkbox"
            checked={Boolean(selected)}
            disabled={compareDisabled && !selected}
            onChange={onCompare}
            aria-label={`${copy.compare} ${name}`}
          />
        </label>
      ) : null}
      <UniversityMark slug={record.slug} size="directory" />
      <div className="discovery-card-content">
        <h3>
          <Link
            href={`/universities/${record.slug}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
            data-analytics-event={
              analyticsSource ? "search_result_record_click" : "nav_click"
            }
            data-analytics-entity-slug={record.slug}
            data-analytics-result-source={analyticsSource}
          >
            {name}
          </Link>
        </h3>
        <p className="discovery-location">
          {[record.region, record.country].filter(Boolean).join(", ")}
        </p>
        {showDate && record.lastCheckedAt ? (
          <p className="discovery-date">
            {copy.lastChecked}{" "}
            <time dateTime={record.lastCheckedAt}>
              {formatDateMedium(record.lastCheckedAt, locale)}
            </time>
          </p>
        ) : null}
        {featured ? (
          <>
            <p className="discovery-card-summary">
              {mockupCopy(locale).guideLead}
            </p>
            <div className="discovery-topic-chips">
              {discoveryPrimaryTopics
                .filter((t) => record.topics?.includes(t))
                .map((t) => (
                  <span key={t}>{discoveryTopicLabel(t, locale)}</span>
                ))}
            </div>
          </>
        ) : null}
        {record.summary ? (
          <p className="discovery-card-summary" data-i18n="preserve">
            {record.summary}
          </p>
        ) : null}
        <div className="discovery-actions">
          <Link
            className="discovery-outline-link"
            href={`/universities/${record.slug}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
            data-analytics-event={
              analyticsSource ? "search_result_record_click" : "nav_click"
            }
            data-analytics-entity-slug={record.slug}
            data-analytics-result-source={analyticsSource}
          >
            {copy.viewGuide}
            <DiscoveryIcon name="arrow" />
          </Link>
          <Link
            className={featured ? "discovery-outline-link" : undefined}
            href={`/universities/${record.slug}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}#claims`}
          >
            {featured ? <DiscoveryIcon name="document" /> : null}
            {featured ? copy.viewEvidence : copy.evidence}
          </Link>
          <Link href={`/changes/${record.slug}`}>{copy.history}</Link>
        </div>
      </div>
    </article>
  );
}

export function DiscoveryPagination({
  page,
  pageCount,
  onPage,
  locale,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  locale: SupportedLocale;
}) {
  const copy = discoveryCopy(locale),
    extra = rankingBrowserCopy(locale);
  const [jump, setJump] = useState(String(page));
  useEffect(() => setJump(String(page)), [page]);
  const numbers = [
    ...new Set([
      1,
      Math.max(1, page - 1),
      page,
      Math.min(pageCount, page + 1),
      pageCount,
    ]),
  ].sort((a, b) => a - b);
  return (
    <nav className="discovery-pagination" aria-label={copy.page}>
      <button
        type="button"
        aria-label={extra.first}
        disabled={page <= 1}
        onClick={() => onPage(1)}
      >
        «
      </button>
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        {copy.previous}
      </button>
      {numbers.map((p, i) => (
        <span className="discovery-page-number" key={p}>
          {i > 0 && p - numbers[i - 1] > 1 ? (
            <span aria-hidden="true">…</span>
          ) : null}
          <button
            type="button"
            aria-label={`${copy.page} ${p}`}
            aria-current={p === page ? "page" : undefined}
            onClick={() => onPage(p)}
          >
            {p.toLocaleString(locale)}
          </button>
        </span>
      ))}
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        {copy.next}
      </button>
      <button
        type="button"
        aria-label={extra.last}
        disabled={page >= pageCount}
        onClick={() => onPage(pageCount)}
      >
        »
      </button>
      <form
        className="discovery-page-jump"
        onSubmit={(e) => {
          e.preventDefault();
          if (/^\d+$/.test(jump) && Number.isSafeInteger(Number(jump)))
            onPage(Math.min(pageCount, Math.max(1, Number(jump))));
        }}
      >
        <label>
          {extra.jump}
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max={pageCount}
            step="1"
            value={jump}
            onChange={(e) => setJump(e.target.value)}
          />
        </label>
        <button type="submit">{extra.go}</button>
      </form>
      <span className="visually-hidden" aria-live="polite">
        {copy.page} {page} {copy.of} {pageCount}
      </span>
    </nav>
  );
}

export function DiscoveryEmpty({
  locale,
  onReset,
}: {
  locale: SupportedLocale;
  onReset?: () => void;
}) {
  const copy = discoveryCopy(locale);
  return (
    <div className="discovery-empty" role="status">
      <DiscoveryIcon name="search" />
      <h3>{copy.noResults}</h3>
      <p>{copy.noResultsLead}</p>
      {onReset ? (
        <button type="button" onClick={onReset}>
          {copy.reset}
        </button>
      ) : (
        <Link href="/universities">{copy.browseDirectory}</Link>
      )}
    </div>
  );
}

export function DiscoveryLoadState({
  locale,
  loading,
  error,
  partial,
  onLoad,
}: {
  locale: SupportedLocale;
  loading: boolean;
  error: boolean;
  partial: boolean;
  onLoad: () => void;
}) {
  const copy = discoveryCopy(locale);
  if (!loading && !error && !partial) return null;
  return (
    <div
      className={`discovery-load-state${error ? " is-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      <span>
        {loading ? copy.loading : error ? copy.loadError : copy.partial}
      </span>
      {!loading ? (
        <button
          className="discovery-text-button"
          type="button"
          onClick={onLoad}
        >
          {error ? copy.retry : copy.loadAll}
        </button>
      ) : null}
    </div>
  );
}

export function DiscoveryCompareTray({
  selected,
  names,
  onRemove,
  onClear,
  locale,
}: {
  selected: string[];
  names: Record<string, string>;
  onRemove: (slug: string) => void;
  onClear: () => void;
  locale: SupportedLocale;
}) {
  const copy = discoveryCopy(locale);
  if (!selected.length) return null;
  const host =
    selected.find((slug) => publishedV6Slugs.includes(slug)) ??
    "harvard-university";
  const href = `/universities/${host}?${new URLSearchParams({ compare: selected.join(","), view: "compare" })}`;
  return (
    <section
      className="discovery-compare-tray"
      aria-label={copy.compareUniversities}
    >
      <div className="discovery-compare-inner">
        <span className="discovery-compare-count" aria-live="polite">
          {selected.length} {copy.selected}
        </span>
        <div className="discovery-compare-chips">
          {selected.map((slug) => (
            <button
              type="button"
              key={slug}
              onClick={() => onRemove(slug)}
              aria-label={`${copy.remove} ${names[slug] ?? slug}`}
            >
              <UniversityMark slug={slug} size="chip" />
              <span>{names[slug] ?? slug}</span>
              <DiscoveryIcon name="close" />
            </button>
          ))}
        </div>
        <div className="discovery-compare-actions">
          {selected.length >= 2 ? (
            <Link className="discovery-primary-link" href={href}>
              {copy.compare}
              <DiscoveryIcon name="arrow" />
            </Link>
          ) : (
            <span className="discovery-compare-hint">{copy.compareHint}</span>
          )}
          <button type="button" onClick={onClear}>
            {copy.clear}
          </button>
        </div>
      </div>
    </section>
  );
}

// Fetch only on interaction. Deduplicated per component with an abortable request;
// raw university policy objects never enter browser storage.
export function useDiscoveryRecords<T>(
  initial: T[],
  url: string,
  total: number,
) {
  const [records, setRecords] = useState(initial);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const loaded = useRef(initial.length >= total);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    setReady(true);
    return () => {
      controller.current?.abort();
      controller.current = null;
    };
  }, []);
  const load = useCallback(async () => {
    if (loaded.current || controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(url, { signal: request.signal });
      if (!response.ok) throw new Error("Records unavailable");
      const payload = await response.json();
      if (!Array.isArray(payload.data?.records))
        throw new Error("Invalid records response");
      if (!request.signal.aborted) {
        setRecords(payload.data.records);
        loaded.current = true;
      }
    } catch {
      if (!request.signal.aborted) setError(true);
    } finally {
      if (!request.signal.aborted) setLoading(false);
      if (controller.current === request) controller.current = null;
    }
  }, [url]);
  return {
    records,
    loading,
    error,
    ready,
    full: records.length >= total,
    load,
  };
}
