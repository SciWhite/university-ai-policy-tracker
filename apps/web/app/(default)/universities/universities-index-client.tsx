"use client";

import { useEffect, useMemo, useState } from "react";
import type { RankingSystemId } from "@uapt/shared";
import {
  DiscoveryCompareTray,
  DiscoveryEmpty,
  DiscoveryFilters,
  DiscoveryIcon,
  DiscoveryLoadState,
  DiscoveryPagination,
  DiscoveryUniversityCard,
  useDiscoveryRecords,
} from "@/components/discovery-ui";
import {
  discoveryCopy,
  discoveryTopics,
  discoveryTopicLabel,
} from "@/lib/discovery-copy";
import {
  getInstitutionLocalizedAliasesByLocale,
  getLocalizedInstitutionName,
} from "@/lib/institution-localization";
import { discoveryPrimaryTopics } from "@/lib/discovery-topic-groups";
import { canonicalUniversitySlugs } from "@/lib/canonical-university-slug";
import { localizeHref, type SupportedLocale } from "@/lib/i18n";
import { normalizeForSearch, textMatchesNormalized } from "@/lib/search-text";
import type {
  StaticUniversityIndexRecord,
  UniversityIndexRankingSystem,
} from "@/lib/university-index-records";

interface Filters {
  q: string;
  country: string;
  topics: string[];
  ranking: RankingSystemId;
  coverage: string;
  sort: string;
  order: string;
  view: string;
  page: number;
  compare: string[];
}
const defaults: Filters = {
  q: "",
  country: "",
  topics: [],
  ranking: "qs",
  coverage: "all",
  sort: "name",
  order: "asc",
  view: "grid",
  page: 1,
  compare: [],
};
function parse(params: URLSearchParams): Filters {
  return {
    q: params.get("q") ?? "",
    country: params.get("country") ?? "",
    topics: params
      .getAll("topic")
      .filter((t) =>
        discoveryTopics.includes(t as (typeof discoveryTopics)[number]),
      ),
    ranking: (["qs", "the", "arwu", "usnews", "cwts"].includes(
      params.get("ranking") ?? "",
    )
      ? params.get("ranking")
      : "qs") as RankingSystemId,
    coverage: ["ranked", "missing"].includes(params.get("coverage") ?? "")
      ? params.get("coverage")!
      : "all",
    sort: ["rank", "name", "recent", "claims", "sources"].includes(
      params.get("sort") ?? "",
    )
      ? params.get("sort")!
      : "name",
    order: params.get("order") === "desc" ? "desc" : "asc",
    view: params.get("view") === "list" ? "list" : "grid",
    page: Math.max(1, Math.min(10000, Number(params.get("page")) || 1)),
    compare: canonicalUniversitySlugs(
      (params.get("compare") ?? "")
        .split(",")
        .filter((s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)),
    ).slice(0, 4),
  };
}
function toUrl(filters: Filters, locale: SupportedLocale) {
  const p = new URLSearchParams();
  for (const key of [
    "q",
    "country",
    "ranking",
    "coverage",
    "sort",
    "order",
    "view",
  ] as const)
    if (filters[key] && filters[key] !== defaults[key])
      p.set(key, filters[key]);
  filters.topics.forEach((t) => p.append("topic", t));
  if (filters.page > 1) p.set("page", String(filters.page));
  if (filters.compare.length) p.set("compare", filters.compare.join(","));
  return localizeHref(`/universities${p.size ? `?${p}` : ""}`, locale);
}

export function UniversitiesIndexClient({
  initialRecords,
  universityNames,
  locale,
  rankingSystems,
  totalRecordCount,
  countries,
  topicIndex,
}: {
  initialRecords: StaticUniversityIndexRecord[];
  universityNames: Record<string, string>;
  locale: SupportedLocale;
  rankingSystems: UniversityIndexRankingSystem[];
  totalRecordCount: number;
  countries: string[];
  topicIndex: Record<string, string[]>;
}) {
  const copy = discoveryCopy(locale);
  const [filters, setFilters] = useState(defaults);
  const data = useDiscoveryRecords(
    initialRecords,
    "/api/public/v1/university-index.json",
    totalRecordCount,
  );
  useEffect(() => {
    const sync = () =>
      setFilters(parse(new URLSearchParams(window.location.search)));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const needsAll = Boolean(
    filters.q ||
      filters.country ||
      filters.topics.length ||
      filters.ranking !== "qs" ||
      filters.coverage !== "all" ||
      filters.sort !== defaults.sort ||
      filters.order !== "asc" ||
      filters.page > 1,
  );
  // The loader guards concurrent calls; a failed request is retried explicitly.
  useEffect(() => {
    if (needsAll && !data.full && !data.error) void data.load();
  }, [needsAll, data.full, data.error, data.load]);
  const rows = useMemo(() => {
    const query = normalizeForSearch(filters.q);
    return data.records
      .filter((r) => {
        const ranking = r.rankings.find((x) => x.systemId === filters.ranking);
        if (filters.country && r.country !== filters.country) return false;
        if (
          (filters.coverage === "ranked" && !ranking) ||
          (filters.coverage === "missing" && ranking)
        )
          return false;
        if (
          filters.topics.length &&
          !filters.topics.every((t) => topicIndex[r.slug]?.includes(t))
        )
          return false;
        return (
          !query ||
          textMatchesNormalized(
            [
              r.name,
              r.country,
              r.region,
              ...(r.aliases ?? []),
              getLocalizedInstitutionName(r.slug, r.name, locale),
              ...getInstitutionLocalizedAliasesByLocale(r.slug, locale),
            ].join(" "),
            query,
          )
        );
      })
      .sort((a, b) => {
        let v = 0;
        if (filters.sort === "name")
          v = getLocalizedInstitutionName(a.slug, a.name, locale).localeCompare(
            getLocalizedInstitutionName(b.slug, b.name, locale),
            locale,
          );
        else if (filters.sort === "recent")
          v =
            (Date.parse(b.lastCheckedAt ?? "") || 0) -
            (Date.parse(a.lastCheckedAt ?? "") || 0);
        else if (filters.sort === "claims") v = b.claimCount - a.claimCount;
        else if (filters.sort === "sources") v = b.sourceCount - a.sourceCount;
        else
          v =
            (a.rankings.find((x) => x.systemId === filters.ranking)
              ?.rankNumber ?? Infinity) -
            (b.rankings.find((x) => x.systemId === filters.ranking)
              ?.rankNumber ?? Infinity);
        return (
          (v || a.name.localeCompare(b.name)) *
          (filters.order === "desc" ? -1 : 1)
        );
      });
  }, [data.records, filters, locale, topicIndex]);
  const pageCount = Math.max(
    1,
    Math.ceil((!data.full && !needsAll ? totalRecordCount : rows.length) / 6),
  );
  const page = Math.min(filters.page, pageCount);
  const visible = rows.slice((page - 1) * 6, page * 6);
  const names = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(universityNames).map(([slug, name]) => [
          slug,
          getLocalizedInstitutionName(slug, name, locale),
        ]),
      ),
    [universityNames, locale],
  );
  function update(patch: Partial<Filters>) {
    const next = { ...filters, ...patch, page: patch.page ?? 1 };
    setFilters(next);
    window.history.pushState(null, "", toUrl(next, locale));
  }
  function reset() {
    const next = { ...defaults, compare: filters.compare };
    setFilters(next);
    window.history.pushState(null, "", toUrl(next, locale));
  }
  function toggle(slug: string) {
    update({
      compare: filters.compare.includes(slug)
        ? filters.compare.filter((s) => s !== slug)
        : [...filters.compare, slug].slice(0, 4),
      page: filters.page,
    });
  }
  return (
    <>
      <main
        className="discovery-page university-mockup-page"
        data-discovery-page="universities"
        data-discovery-ready={data.ready}
      >
        <div className="discovery-layout">
          <DiscoveryFilters
            title={copy.filterUniversities}
            id="university-filter-fields"
          >
            <label>
              {copy.country}
              <select
                value={filters.country}
                onChange={(e) => update({ country: e.target.value })}
              >
                <option value="">{copy.allCountries}</option>
                {countries.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              {copy.ranking}
              <select
                value={filters.ranking}
                onChange={(e) =>
                  update({ ranking: e.target.value as RankingSystemId })
                }
              >
                {rankingSystems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>{copy.topics}</legend>
              {discoveryPrimaryTopics.map((t) => (
                <label className="discovery-check" key={t}>
                  <input
                    type="checkbox"
                    checked={filters.topics.includes(t)}
                    onChange={() =>
                      update({
                        topics: filters.topics.includes(t)
                          ? filters.topics.filter((x) => x !== t)
                          : [...filters.topics, t],
                      })
                    }
                  />
                  {discoveryTopicLabel(t, locale)}
                </label>
              ))}
            </fieldset>
            <details className="discovery-filter-extra">
              <summary>{copy.moreFilters}</summary>{" "}
              <label>
                {copy.coverage}
                <select
                  value={filters.coverage}
                  onChange={(e) => update({ coverage: e.target.value })}
                >
                  <option value="all">{copy.allRecords}</option>
                  <option value="ranked">{copy.rankedOnly}</option>
                  <option value="missing">{copy.missingRank}</option>
                </select>
              </label>
              <label>
                <span className="visually-hidden">
                  {copy.ascending} / {copy.descending}
                </span>
                <select
                  value={filters.order}
                  onChange={(e) => update({ order: e.target.value })}
                >
                  <option value="asc">{copy.ascending}</option>
                  <option value="desc">{copy.descending}</option>
                </select>
              </label>
            </details>
            <button type="button" onClick={reset}>
              {copy.reset}
            </button>
          </DiscoveryFilters>
          <section
            className="discovery-results"
            aria-label={copy.browse}
            aria-busy={data.loading}
          >
            {" "}
            <header className="discovery-header">
              <div>
                <h1>{copy.findUniversity}</h1>
                <p>{copy.directoryLead}</p>
              </div>
            </header>
            <form
              className="discovery-search-form"
              action={localizeHref("/universities", locale)}
              method="get"
              onSubmit={(e) => {
                e.preventDefault();
                if (!data.full) void data.load();
              }}
            >
              <label className="discovery-search-field">
                <span className="visually-hidden">{copy.search}</span>
                <DiscoveryIcon name="search" />
                <input
                  name="q"
                  type="search"
                  placeholder={copy.directoryPlaceholder}
                  value={filters.q}
                  onChange={(e) => update({ q: e.target.value })}
                />
              </label>
              <button type="submit">{copy.search}</button>
            </form>
            <p className="discovery-muted">
              {totalRecordCount.toLocaleString(locale)} {copy.universityRecords}
            </p>
            <div className="discovery-result-toolbar">
              <div>
                <h2>{copy.browse}</h2>
                <p className="visually-hidden" aria-live="polite">
                  {copy.showing} {visible.length ? (page - 1) * 6 + 1 : 0}–
                  {Math.min(page * 6, rows.length)} {copy.of}{" "}
                  {(!data.full && !needsAll
                    ? totalRecordCount
                    : rows.length
                  ).toLocaleString(locale)}
                </p>
              </div>
              <div className="discovery-sort">
                <label>
                  {copy.sort}
                  <select
                    value={filters.sort}
                    onChange={(e) => update({ sort: e.target.value })}
                  >
                    <option value="rank">{copy.rankOrder}</option>
                    <option value="name">{copy.name}</option>
                    <option value="recent">{copy.checked}</option>
                    <option value="claims">{copy.mostClaims}</option>
                    <option value="sources">{copy.mostSources}</option>
                  </select>
                </label>
                <div className="discovery-view-switch">
                  <button
                    type="button"
                    aria-label={copy.grid}
                    aria-pressed={filters.view === "grid"}
                    onClick={() => update({ view: "grid", page: filters.page })}
                  >
                    <DiscoveryIcon name="grid" />
                  </button>
                  <button
                    type="button"
                    aria-label={copy.list}
                    aria-pressed={filters.view === "list"}
                    onClick={() => update({ view: "list", page: filters.page })}
                  >
                    <DiscoveryIcon name="list" />
                  </button>
                </div>
              </div>
            </div>
            <div className="discovery-topic-chips" aria-label={copy.topics}>
              {discoveryPrimaryTopics.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={filters.topics.includes(t)}
                  onClick={() =>
                    update({
                      topics: filters.topics.includes(t)
                        ? filters.topics.filter((x) => x !== t)
                        : [...filters.topics, t],
                    })
                  }
                >
                  {discoveryTopicLabel(t, locale)}
                </button>
              ))}
            </div>
            <DiscoveryLoadState
              locale={locale}
              loading={data.loading}
              error={data.error}
              partial={false}
              onLoad={() => void data.load()}
            />
            {visible.length ? (
              <div
                className={`discovery-university-grid${filters.view === "list" ? " discovery-grid--list" : ""}`}
              >
                {visible.map((r) => (
                  <DiscoveryUniversityCard
                    key={r.slug}
                    record={{ ...r, summary: undefined }}
                    showDate={false}
                    locale={locale}
                    selected={filters.compare.includes(r.slug)}
                    compareDisabled={filters.compare.length >= 4}
                    onCompare={() => toggle(r.slug)}
                  />
                ))}
              </div>
            ) : !data.loading ? (
              <DiscoveryEmpty locale={locale} onReset={reset} />
            ) : null}
            <DiscoveryPagination
              locale={locale}
              page={page}
              pageCount={pageCount}
              onPage={(p) => update({ page: p })}
            />
          </section>
        </div>
      </main>
      <DiscoveryCompareTray
        locale={locale}
        selected={filters.compare}
        names={names}
        onRemove={toggle}
        onClear={() => update({ compare: [], page: filters.page })}
      />
    </>
  );
}
