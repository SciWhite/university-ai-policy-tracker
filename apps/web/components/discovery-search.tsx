"use client";

import { useEffect, useMemo, useState } from "react";
import { DocumentLink as Link } from "./document-link";
import { SearchAutocomplete } from "./search-autocomplete";
import {
  DiscoveryEmpty,
  DiscoveryFilters,
  DiscoveryIcon,
  DiscoveryUniversityCard,
} from "./discovery-ui";
import {
  discoveryCopy,
  discoveryTopics,
  discoveryTopicLabel,
} from "@/lib/discovery-copy";
import type {
  DiscoveryEvidence,
  DiscoveryUniversity,
} from "@/lib/discovery-types";
import { mockupCopy } from "@/lib/mockup-copy";
import { discoveryPrimaryTopics } from "@/lib/discovery-topic-groups";
import { localizeHref, type SupportedLocale } from "@/lib/i18n";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";

type SearchState = {
  country: string;
  topic: string;
  type: string;
  sort: string;
};
function parse() {
  const p = new URLSearchParams(window.location.search);
  return {
    country: p.get("country") ?? "",
    topic: p.get("topic") ?? "",
    type: ["universities", "evidence", "sources"].includes(p.get("type") ?? "")
      ? p.get("type")!
      : "all",
    sort: p.get("sort") === "name" ? "name" : "relevance",
  };
}
const initialState = { country: "", topic: "", type: "all", sort: "relevance" };

export function DiscoverySearch({
  locale,
  query,
  records,
  evidence,
  children,
}: {
  locale: SupportedLocale;
  query: string;
  records: DiscoveryUniversity[];
  evidence: DiscoveryEvidence[];
  children: React.ReactNode;
}) {
  const copy = discoveryCopy(locale);
  const design = mockupCopy(locale);
  const [state, setState] = useState<SearchState>(initialState);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setState(parse());
    sync();
    setReady(true);
    window.addEventListener("popstate", sync);
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !target?.closest('input,textarea,select,[contenteditable="true"]')
      ) {
        event.preventDefault();
        document.getElementById("discovery-search-input")?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("keydown", focusSearch);
    };
  }, []);
  function href(next: SearchState) {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (next.country) p.set("country", next.country);
    if (next.topic) p.set("topic", next.topic);
    if (next.type !== "all") p.set("type", next.type);
    if (next.sort !== "relevance") p.set("sort", next.sort);
    return localizeHref(`/search${p.size ? `?${p}` : ""}`, locale);
  }
  function update(patch: Partial<SearchState>) {
    const next = { ...state, ...patch };
    setState(next);
    window.history.pushState(null, "", href(next));
  }
  const countries = useMemo(
    () =>
      [
        ...new Set(
          records.map((r) => r.country).filter((s): s is string => Boolean(s)),
        ),
      ].sort(),
    [records],
  );
  const filteredRecords = useMemo(
    () =>
      records
        .filter(
          (r) =>
            (!state.country || r.country === state.country) &&
            (!state.topic || r.topics?.includes(state.topic)),
        )
        .sort((a, b) =>
          state.sort === "name"
            ? getLocalizedInstitutionName(a.slug, a.name, locale).localeCompare(
                getLocalizedInstitutionName(b.slug, b.name, locale),
                locale,
              )
            : (b.relevance ?? 0) - (a.relevance ?? 0),
        ),
    [records, state, locale],
  );
  const filteredEvidence = useMemo(
    () =>
      evidence.filter(
        (e) =>
          (!state.country || e.country === state.country) &&
          (!state.topic ||
            e.topic === state.topic ||
            e.topics?.includes(state.topic)),
      ),
    [evidence, state.country, state.topic],
  );
  const sources = useMemo(
    () => [
      ...new Map(
        filteredEvidence
          .filter((e) => e.official)
          .map((e) => [`${e.slug}:${e.sourceUrl}`, e]),
      ).values(),
    ],
    [filteredEvidence],
  );
  const displayUniversities =
    state.type === "all" || state.type === "universities";
  const displayEvidence = state.type === "all" || state.type === "evidence";
  const count =
    state.type === "sources"
      ? sources.length
      : (displayUniversities ? filteredRecords.length : 0) +
        (displayEvidence ? filteredEvidence.length : 0);
  return (
    <main
      className="discovery-page"
      data-discovery-page="search"
      data-discovery-ready={ready}
    >
      <header className="discovery-header">
        <div>
          <h1>{copy.searchTitle}</h1>
          {!query ? <p>{copy.searchLead}</p> : null}
        </div>
      </header>
      <form
        className="discovery-search-form"
        action={localizeHref("/search", locale)}
        method="get"
        data-analytics-event="search_submit"
      >
        <div className="discovery-search-field">
          <DiscoveryIcon name="search" />
          <label className="visually-hidden" htmlFor="discovery-search-input">
            {copy.search}
          </label>
          <SearchAutocomplete
            defaultValue={query}
            id="discovery-search-input"
            name="q"
            placeholder={copy.searchPlaceholder}
            preserveQueryOnEscape
            focusOnly
            clearLabel={design.clearSearch}
          />
        </div>
        <button type="submit">{copy.search}</button>
      </form>
      {!query ? (
        <div className="discovery-quick-queries">
          {["MIT", "privacy", "disclosure", "Copilot"].map((q) => (
            <Link key={q} href={`/search?q=${q}`}>
              {q}
            </Link>
          ))}
        </div>
      ) : null}
      <nav className="discovery-tabs" aria-label={copy.filterResults}>
        {[
          ["all", copy.allResults],
          ["evidence", copy.policyEvidence],
          ["sources", copy.officialSources],
        ].map(([type, label]) => (
          <a
            key={type}
            href={href({ ...state, type })}
            aria-current={state.type === type ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              update({ type });
            }}
          >
            {label}
          </a>
        ))}
        <span className="discovery-search-shortcut">{design.focusSearch}</span>
      </nav>
      <div className="discovery-layout">
        <DiscoveryFilters title={copy.filterResults} id="search-filter-fields">
          <label>
            {copy.country}
            <select
              value={state.country}
              onChange={(e) => update({ country: e.target.value })}
            >
              <option value="">{design.allCountriesShort}</option>
              {countries.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>{copy.topics}</legend>
            {discoveryPrimaryTopics.map((t) => (
              <label className="discovery-check" key={t}>
                <input
                  type="checkbox"
                  checked={state.topic === t}
                  onChange={() => update({ topic: state.topic === t ? "" : t })}
                />
                {discoveryTopicLabel(t, locale)}
              </label>
            ))}
          </fieldset>
          <button type="button" onClick={() => update({ ...initialState })}>
            {copy.reset}
          </button>
        </DiscoveryFilters>
        <section className="discovery-results" aria-label={copy.allResults}>
          <div className="discovery-result-toolbar">
            <div>
              <h2>
                {query ? (
                  <>
                    {copy.resultsFor} “{query}”
                  </>
                ) : (
                  copy.suggested
                )}
              </h2>
              <p aria-live="polite">
                {count.toLocaleString(locale)} {copy.results}
              </p>
            </div>
            <label className="discovery-field">
              {copy.sort}
              <select
                value={state.sort}
                onChange={(e) => update({ sort: e.target.value })}
              >
                <option value="relevance">{copy.relevance}</option>
                <option value="name">{copy.name}</option>
              </select>
            </label>
          </div>
          {query && records.length >= 50 ? (
            <p className="discovery-muted">{copy.searchLimit}</p>
          ) : null}
          {count ? (
            <div className="discovery-search-results">
              {displayUniversities
                ? filteredRecords.map((r) => (
                    <DiscoveryUniversityCard
                      key={r.slug}
                      locale={locale}
                      record={{ ...r, summary: undefined }}
                      featured
                      analyticsSource={query ? "query" : "suggested"}
                    />
                  ))
                : null}
              {displayEvidence && filteredEvidence.length ? (
                <>
                  {filteredEvidence.map((e) => (
                    <article
                      className="discovery-evidence-card discovery-evidence-card--compact"
                      key={e.id}
                    >
                      <span className="discovery-evidence-label">
                        <DiscoveryIcon name="document" />
                        {e.official ? design.officialEvidence : copy.sources}
                      </span>
                      <div className="discovery-evidence-content">
                        <h3 data-i18n="preserve">{e.sourceTitle}</h3>
                        <p className="discovery-evidence-claim">
                          {e.official ? design.evidenceLead : design.guideLead}
                        </p>
                        <p className="discovery-evidence-attribution">
                          <Link href={`/universities/${e.slug}`}>
                            {getLocalizedInstitutionName(
                              e.slug,
                              e.universityName,
                              locale,
                            )}
                          </Link>
                          <span> · </span>
                          <a href={e.sourceUrl} rel="noopener noreferrer">
                            {new URL(e.sourceUrl).hostname} ↗
                          </a>
                        </p>
                        <details className="discovery-excerpt">
                          <summary>{copy.originalExcerpt}</summary>
                          <p data-i18n="preserve">{e.claimText}</p>
                          <blockquote
                            lang={e.sourceLanguage}
                            data-i18n="preserve"
                          >
                            {e.snippet}
                          </blockquote>
                        </details>
                      </div>
                      <Link
                        className="discovery-outline-link"
                        href={e.claimUrl}
                      >
                        <DiscoveryIcon name="document" />
                        {copy.viewEvidence}
                      </Link>
                    </article>
                  ))}
                </>
              ) : null}
              {state.type === "sources"
                ? sources.map((e) => (
                    <article
                      className="discovery-evidence-card"
                      key={`${e.slug}:${e.sourceUrl}`}
                    >
                      <div className="discovery-evidence-meta">
                        <span>{copy.officialSource}</span>
                        <span>
                          {getLocalizedInstitutionName(
                            e.slug,
                            e.universityName,
                            locale,
                          )}
                        </span>
                      </div>
                      <h3 data-i18n="preserve">{e.sourceTitle}</h3>
                      <p className="discovery-muted">
                        {new URL(e.sourceUrl).hostname}
                      </p>
                      <div className="discovery-actions">
                        <a
                          className="discovery-outline-link"
                          href={e.sourceUrl}
                          rel="noopener noreferrer"
                        >
                          {copy.officialSource} ↗
                        </a>
                        <Link href={e.claimUrl}>{copy.viewEvidence}</Link>
                      </div>
                    </article>
                  ))
                : null}
            </div>
          ) : (
            <DiscoveryEmpty
              locale={locale}
              onReset={() => update({ ...initialState })}
            />
          )}
          <div className="discovery-help">
            <p>{copy.searchHelp}</p>
            <Link href="/universities">{copy.browseDirectory}</Link>
          </div>
        </section>
      </div>
      <details className="discovery-data">
        <summary>{copy.data}</summary>
        <div className="discovery-data-body">{children}</div>
      </details>
    </main>
  );
}
