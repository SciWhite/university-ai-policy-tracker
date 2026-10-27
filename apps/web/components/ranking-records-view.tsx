"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DocumentLink as Link } from "./document-link";
import {
  DiscoveryCompareTray,
  DiscoveryEmpty,
  DiscoveryIcon,
  DiscoveryPagination,
} from "./discovery-ui";
import {
  UniversityDirectoryLayout,
  RankingsBrowserLayout,
} from "./discovery-browser-layouts";
import { UniversityDirectoryResults, RankingTable } from "./discovery-results";
import { discoveryCopy, discoveryTopicLabel } from "@/lib/discovery-copy";
import { discoveryPrimaryTopics } from "@/lib/discovery-topic-groups";
import { mockupCopy } from "@/lib/mockup-copy";
import { rankingsCopy } from "@/lib/rankings-copy";
import { rankingBrowserCopy } from "@/lib/ranking-browser-copy";
import {
  getRankingEdition,
  rankingEditions,
  rankingSystems,
} from "@/lib/ranking-editions";
import {
  defaultDiscoveryQuery,
  discoveryQueryString,
  pageSizes,
  type DiscoveryMode,
  type DiscoveryQuery,
} from "@/lib/discovery-query";
import {
  saveDiscoveryPosition,
  useDiscoveryPosition,
} from "@/lib/discovery-return-state";
import { localizeHref, type SupportedLocale } from "@/lib/i18n";
import type { DiscoveryPageData } from "@/lib/rankings-view-data";

export function RankingRecordsView({
  data,
  locale,
  mode = "rankings",
  pathname,
}: {
  data: DiscoveryPageData;
  locale: SupportedLocale;
  mode?: DiscoveryMode;
  pathname: string;
}) {
  const router = useRouter(),
    [busy, startTransition] = useTransition();
  const query = data.query,
    ui = discoveryCopy(locale),
    copy = rankingBrowserCopy(locale),
    edition = getRankingEdition(query.edition)!;
  const fixedEdition =
    mode === "rankings" && pathname !== "/rankings" ? query.edition : undefined;
  const [search, setSearch] = useState(query.q),
    [compare, setCompare] = useState(query.compare),
    [topics, setTopics] = useState(query.topics);
  const [hydrated, setHydrated] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false),
    [topicsOpen, setTopicsOpen] = useState(false);
  const topicBox = useRef<HTMLDivElement>(null);
  const names = useRef<Record<string, string>>({ ...data.compareNames });
  for (const row of data.rows) if (row.slug) names.current[row.slug] = row.name;
  useEffect(() => setHydrated(true), []);
  useEffect(() => setSearch(query.q), [query.q]);
  useEffect(() => setCompare(query.compare), [query.compare]);
  useEffect(() => setTopics(query.topics), [query.topics]);
  useEffect(() => {
    const sync = () =>
      setCompare(
        (new URLSearchParams(location.search).get("compare") ?? "")
          .split(",")
          .filter(Boolean),
      );
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (topicBox.current && !topicBox.current.contains(event.target as Node))
        setTopicsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTopicsOpen(false);
        topicBox.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const currentQuery = { ...query, compare };
  const returnTo =
    localizeHref(pathname, locale) +
    discoveryQueryString(currentQuery, mode, fixedEdition);
  useDiscoveryPosition(returnTo);
  useEffect(() => {
    if (location.pathname + location.search !== returnTo)
      window.history.replaceState(window.history.state, "", returnTo);
  }, [returnTo]);
  function update(patch: Partial<DiscoveryQuery>, target = pathname) {
    const next = { ...currentQuery, ...patch, page: patch.page ?? 1 };
    const fixed =
      mode === "rankings" && target !== "/rankings" ? next.edition : undefined;
    startTransition(() =>
      router.push(
        localizeHref(target, locale) + discoveryQueryString(next, mode, fixed),
        { scroll: false },
      ),
    );
  }
  function switchEdition(slug: string) {
    setTopicsOpen(false);
    update(
      { edition: slug, page: 1 },
      mode === "rankings" ? `/rankings/${slug}` : "/universities",
    );
  }
  function changeCompare(next: string[]) {
    setCompare(next);
    window.history.replaceState(
      window.history.state,
      "",
      localizeHref(pathname, locale) +
        discoveryQueryString({ ...query, compare: next }, mode, fixedEdition),
    );
  }
  function toggle(slug: string) {
    changeCompare(
      compare.includes(slug)
        ? compare.filter((s) => s !== slug)
        : [...compare, slug].slice(0, 4),
    );
  }
  function toggleTopic(topic: string) {
    const next = topics.includes(topic)
      ? topics.filter((t) => t !== topic)
      : [...topics, topic];
    setTopics(next);
    update({ topics: next });
  }
  function reset() {
    setSearch("");
    setTopics([]);
    const defaults = defaultDiscoveryQuery(mode);
    update({ ...defaults, edition: query.edition, size: query.size, compare });
  }
  const resultRange = (
    <>
      {ui.showing} {data.total ? (query.page - 1) * query.size + 1 : 0}–
      {Math.min(query.page * query.size, data.total)} {ui.of}{" "}
      {data.total.toLocaleString(locale)} {copy.results}
    </>
  );
  const topicChoices = (
    <>
      {discoveryPrimaryTopics.map((topic) => (
        <label key={topic}>
          <input
            type="checkbox"
            checked={topics.includes(topic)}
            onChange={() => toggleTopic(topic)}
          />
          {discoveryTopicLabel(topic, locale)}
        </label>
      ))}
    </>
  );
  const scopeFields = (
    <>
      <label>
        {ui.country}
        <select
          value={query.country}
          onChange={(e) => update({ country: e.target.value })}
        >
          <option value="">{ui.allCountries}</option>
          {data.countries.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      {mode === "universities" ? (
        <fieldset className="directory-topic-choices">
          <legend>{ui.topics}</legend>
          {topicChoices}
        </fieldset>
      ) : (
        <div
          className="ranking-browser-topic-picker"
          ref={topicBox}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node))
              setTopicsOpen(false);
          }}
        >
          <span>{ui.topics}</span>
          <button
            type="button"
            aria-expanded={topicsOpen}
            aria-controls="ranking-topic-options"
            onClick={() => setTopicsOpen(!topicsOpen)}
          >
            {topics.length ? `${ui.topics} (${topics.length})` : ui.allTopics}
            <span aria-hidden="true">⌄</span>
          </button>
          {topicsOpen ? (
            <fieldset id="ranking-topic-options">
              <legend className="visually-hidden">{ui.topics}</legend>
              {topicChoices}
            </fieldset>
          ) : null}
        </div>
      )}
      <label>
        {copy.scope}
        <select
          value={query.scope}
          onChange={(e) => update({ scope: e.target.value })}
        >
          <option value="policy">{copy.policy}</option>
          <option value="all">{copy.all}</option>
          <option value="ranking-only">{copy.only}</option>
        </select>
      </label>
      {mode === "universities" ? (
        <label>
          {ui.coverage}
          <select
            value={query.coverage}
            onChange={(e) => update({ coverage: e.target.value })}
          >
            <option value="all">{ui.allRecords}</option>
            <option value="ranked">{ui.rankedOnly}</option>
            <option value="missing">{ui.missingRank}</option>
          </select>
        </label>
      ) : null}
    </>
  );
  const filters = (
    <div className={`discovery-browser-facets${filtersOpen ? " is-open" : ""}`}>
      <button
        type="button"
        className="discovery-browser-filter-toggle"
        aria-expanded={filtersOpen}
        aria-controls="discovery-facet-fields"
        onClick={() => setFiltersOpen(!filtersOpen)}
      >
        <DiscoveryIcon name="filter" />
        {ui.filterUniversities}
        <span aria-hidden="true">{filtersOpen ? "−" : "+"}</span>
      </button>
      {mode === "universities" ? <h2>{ui.filterUniversities}</h2> : null}
      <div
        id="discovery-facet-fields"
        className="discovery-browser-facet-fields"
      >
        {scopeFields}
        {mode === "universities" ? (
          <button
            className="discovery-text-button"
            type="button"
            onClick={reset}
          >
            {ui.reset}
          </button>
        ) : null}
      </div>
    </div>
  );
  const versionSelect = (
    <label>
      {copy.edition}
      <select
        value={query.edition}
        onChange={(e) => switchEdition(e.target.value)}
      >
        {rankingEditions
          .filter((e) => e.systemId === edition.systemId)
          .map((e) => (
            <option key={e.slug} value={e.slug}>
              {e.label}
            </option>
          ))}
      </select>
    </label>
  );
  const systemSelect = (
    <label>
      {copy.system}
      <select
        value={edition.systemId}
        onChange={(e) =>
          switchEdition(
            rankingEditions.find((x) => x.systemId === e.target.value)!.slug,
          )
        }
      >
        {rankingSystems.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
  const editions =
    mode === "universities" ? (
      <section className="directory-browser-editions" aria-label={copy.edition}>
        {systemSelect}
        {versionSelect}
        <p className="discovery-muted">
          {data.rankingCount.toLocaleString(locale)} {copy.rows} ·{" "}
          {data.linkedCount.toLocaleString(locale)} {copy.linked}
        </p>
      </section>
    ) : (
      <section className="ranking-browser-editions" aria-label={copy.edition}>
        <nav className="ranking-browser-system-tabs" aria-label={copy.system}>
          {rankingSystems.map((s) => (
            <button
              type="button"
              key={s.id}
              aria-current={s.id === edition.systemId ? "page" : undefined}
              onClick={() =>
                switchEdition(
                  rankingEditions.find((e) => e.systemId === s.id)!.slug,
                )
              }
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="ranking-browser-system-select">{systemSelect}</div>
        {versionSelect}
        <span className="ranking-browser-edition-meta">
          {data.linkedCount.toLocaleString(locale)} {copy.linked}
        </span>
      </section>
    );
  const searchForm = (
    <form
      className="discovery-browser-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        update({ q: search });
      }}
    >
      <label>
        <span className="visually-hidden">{ui.search}</span>
        <DiscoveryIcon name="search" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            mode === "universities"
              ? ui.directoryPlaceholder
              : ui.universitySearch
          }
        />
      </label>
      <button type="submit">{ui.search}</button>
    </form>
  );
  const header = (
    <header className="discovery-header">
      <div>
        <Link
          className="mockup-eyebrow"
          href={
            mode === "rankings"
              ? `/universities${discoveryQueryString({ ...currentQuery, page: 1, scope: "policy", sort: "name", order: "asc" }, "universities")}`
              : `/rankings/${query.edition}${discoveryQueryString({ ...currentQuery, page: 1, scope: "all", sort: "rank", order: "asc" }, "rankings", query.edition)}`
          }
          localeOverride={locale}
        >
          {mode === "rankings" ? copy.directory : copy.rankings} ↗
        </Link>
        <h1>{mode === "rankings" ? edition.label : ui.findUniversity}</h1>
        <p>
          {mode === "rankings"
            ? mockupCopy(locale).rankingBoundary
            : ui.directoryLead}
        </p>
      </div>
      <div className="ranking-browser-metrics">
        <strong>
          {(mode === "rankings"
            ? data.rankingCount
            : data.policyCount
          ).toLocaleString(locale)}
        </strong>
        <span>{mode === "rankings" ? copy.rows : copy.policy}</span>
      </div>
    </header>
  );
  const toolbar = (
    <>
      <div className="ranking-browser-toolbar">
        <p role="status">{resultRange}</p>
        <div className="ranking-browser-controls">
          <label>
            {ui.sort}
            <select
              value={query.sort}
              onChange={(e) =>
                update({
                  sort: e.target.value,
                  order: ["recent", "claims", "sources"].includes(
                    e.target.value,
                  )
                    ? "desc"
                    : "asc",
                })
              }
            >
              <option value="rank">
                {edition.systemId === "cwts"
                  ? rankingsCopy(locale).derived
                  : ui.rankOrder}
              </option>
              <option value="name">{ui.name}</option>
              <option value="recent">{ui.checked}</option>
              {mode === "universities" ? (
                <>
                  <option value="claims">{ui.mostClaims}</option>
                  <option value="sources">{ui.mostSources}</option>
                </>
              ) : null}
            </select>
          </label>
          <label>
            <span className="visually-hidden">
              {ui.ascending} / {ui.descending}
            </span>
            <select
              aria-label={`${ui.ascending} / ${ui.descending}`}
              value={query.order}
              onChange={(e) =>
                update({ order: e.target.value as "asc" | "desc" })
              }
            >
              <option value="asc">{ui.ascending} ↑</option>
              <option value="desc">{ui.descending} ↓</option>
            </select>
          </label>
          <label>
            {copy.size}
            <select
              value={query.size}
              onChange={(e) => update({ size: Number(e.target.value) })}
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          {mode === "universities" ? (
            <div className="discovery-view-switch">
              {(["grid", "list"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  aria-label={view === "grid" ? ui.grid : ui.list}
                  aria-pressed={query.view === view}
                  onClick={() => update({ view, page: query.page })}
                >
                  <DiscoveryIcon name={view} />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {query.topics.length ? (
        <div className="discovery-topic-chips">
          {query.topics.map((t) => (
            <button key={t} type="button" onClick={() => toggleTopic(t)}>
              {discoveryTopicLabel(t, locale)} ×
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
  const resultProps = {
    rows: data.rows,
    locale,
    edition: query.edition,
    returnTo,
    compare,
    onCompare: toggle,
  };
  const results = (
    <div
      className="discovery-browser-results"
      data-result-count={data.rows.length}
    >
      {!data.rows.length ? (
        <DiscoveryEmpty locale={locale} onReset={reset} />
      ) : mode === "universities" && query.view === "grid" ? (
        <UniversityDirectoryResults {...resultProps} />
      ) : (
        <RankingTable {...resultProps} />
      )}
    </div>
  );
  const scopeNote =
    query.edition === "qs-2026" || edition.systemId === "cwts" ? (
      <p className="ranking-browser-coverage" role="note">
        ⓘ {query.edition === "qs-2026" ? copy.qsNote : copy.cwtsNote}
      </p>
    ) : null;
  const footer = (
    <>
      <div className="ranking-browser-footer">
        <p>{resultRange}</p>
        <div>
          <button
            className="discovery-text-button"
            type="button"
            disabled={query.page === 1}
            onClick={() => update({ page: 1 })}
          >
            {copy.resetPage}
          </button>
          <button
            className="discovery-text-button"
            type="button"
            onClick={reset}
          >
            {ui.reset}
          </button>
        </div>
      </div>
      <DiscoveryPagination
        page={query.page}
        pageCount={data.pageCount}
        onPage={(page) => update({ page })}
        locale={locale}
      />
      <details className="discovery-technical">
        <summary>{copy.notice}</summary>
        {scopeNote}
        <p>{copy.range}</p>
        <p>{copy.recordNote}</p>
        {data.unrankedCount ? (
          <p>
            {data.unrankedCount.toLocaleString(locale)} {copy.unranked}.
          </p>
        ) : null}
        <p>
          <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer">
            {copy.source}: {edition.label} ↗
          </a>
        </p>
        <nav className="ranking-browser-all-editions" aria-label={copy.edition}>
          {rankingEditions.map((e) => (
            <Link
              key={e.slug}
              href={`/rankings/${e.slug}${discoveryQueryString({ ...currentQuery, edition: e.slug, page: 1 }, "rankings", e.slug)}`}
            >
              {e.label}
            </Link>
          ))}
        </nav>
      </details>
      <DiscoveryCompareTray
        selected={compare}
        names={{ ...names.current, ...data.compareNames }}
        locale={locale}
        onRemove={toggle}
        onClear={() => changeCompare([])}
      />
    </>
  );
  const onResultClick = (event: React.MouseEvent<HTMLElement>) => {
    const link = (event.target as Element).closest("a");
    if (link?.getAttribute("href")?.includes("returnTo="))
      saveDiscoveryPosition(returnTo, link);
  };
  const Layout =
    mode === "universities" ? UniversityDirectoryLayout : RankingsBrowserLayout;
  return (
    <Layout
      header={header}
      editions={editions}
      search={searchForm}
      filters={filters}
      toolbar={toolbar}
      results={results}
      footer={footer}
      scopeNote={scopeNote}
      ready={hydrated}
      busy={busy}
      onResultClick={onResultClick}
    />
  );
}
