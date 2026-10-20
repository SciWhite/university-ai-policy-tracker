"use client";
import { useEffect, useMemo, useState } from "react";
import { DocumentLink as Link } from "./document-link";
import { UniversityMark } from "./university-mark";
import { canonicalUniversitySlugs } from "@/lib/canonical-university-slug";
import {
  DiscoveryCompareTray,
  DiscoveryEmpty,
  DiscoveryIcon,
  DiscoveryPagination,
} from "./discovery-ui";
import { discoveryCopy, discoveryTopicLabel } from "@/lib/discovery-copy";
import { discoveryPrimaryTopics } from "@/lib/discovery-topic-groups";
import { rankingsCopy } from "@/lib/rankings-copy";
import { mockupCopy } from "@/lib/mockup-copy";
import { getInstitutionLocalizedAliases } from "@/lib/institution-localization";
import type { SupportedLocale } from "@/lib/i18n";
import type { RankingViewRow } from "@/lib/rankings-view-data";
const empty = {
  q: "",
  country: "",
  topic: "",
  sort: "rank",
  page: 1,
  compare: [] as string[],
};
function readFilters() {
  const p = new URLSearchParams(location.search);
  return {
    q: p.get("q") ?? "",
    country: p.get("country") ?? "",
    topic: p.get("topic") ?? "",
    sort: ["rank", "name", "recent"].includes(p.get("sort") ?? "")
      ? p.get("sort")!
      : "rank",
    page: Math.max(1, Math.floor(Number(p.get("page"))) || 1),
    compare: canonicalUniversitySlugs(
      (p.get("compare") ?? "")
        .split(",")
        .filter((x) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x)),
    ).slice(0, 4),
  };
}
export function RankingRecordsView({
  rows,
  locale,
  derived,
  currentSlug,
  editions,
}: {
  rows: RankingViewRow[];
  locale: SupportedLocale;
  derived: boolean;
  currentSlug: string;
  editions: { slug: string; label: string }[];
}) {
  const copy = rankingsCopy(locale),
    ui = discoveryCopy(locale),
    design = mockupCopy(locale);
  const [filters, setFilters] = useState(empty);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setFilters(readFilters());
    sync();
    setReady(true);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  function query(next: typeof empty) {
    const p = new URLSearchParams();
    for (const k of ["q", "country", "topic", "sort", "page"] as const)
      if (next[k] !== empty[k]) p.set(k, String(next[k]));
    if (next.compare.length) p.set("compare", next.compare.join(","));
    return p.size ? "?" + p : "";
  }
  function update(patch: Partial<typeof empty>) {
    const next = {
      ...filters,
      ...patch,
      ...(patch.page === undefined ? { page: 1 } : {}),
    };
    setFilters(next);
    history.pushState(null, "", location.pathname + query(next));
  }
  function toggle(slug: string) {
    update({
      compare: filters.compare.includes(slug)
        ? filters.compare.filter((x) => x !== slug)
        : [...filters.compare, slug].slice(0, 4),
      page: filters.page,
    });
  }
  const countries = useMemo(
    () => [...new Set(rows.map((r) => r.country))].sort(),
    [rows],
  );
  const filtered = useMemo(() => {
    const q = filters.q.trim().toLocaleLowerCase(locale);
    return rows
      .filter(
        (r) =>
          (!filters.country || r.country === filters.country) &&
          (!filters.topic || r.topics.includes(filters.topic)) &&
          (!q ||
            [
              r.name,
              r.slug,
              r.country,
              r.region,
              ...getInstitutionLocalizedAliases(r.slug),
            ]
              .join(" ")
              .toLocaleLowerCase(locale)
              .includes(q)),
      )
      .sort((a, b) =>
        filters.sort === "name"
          ? a.name.localeCompare(b.name, locale)
          : filters.sort === "recent"
            ? (b.lastCheckedAt ?? "").localeCompare(a.lastCheckedAt ?? "")
            : (a.rankNumber ?? Infinity) - (b.rankNumber ?? Infinity) ||
              a.name.localeCompare(b.name),
      );
  }, [rows, filters, locale]);
  const pages = Math.max(1, Math.ceil(filtered.length / 5)),
    page = Math.min(filters.page, pages),
    visible = filtered.slice((page - 1) * 5, page * 5),
    names = Object.fromEntries(rows.map((r) => [r.slug, r.name]));
  return (
    <div
      className="ranking-v6-records ranking-v6-records--mockup"
      data-discovery-ready={ready}
    >
      <nav className="rankings-v6-tabs" aria-label={copy.source}>
        {editions.map((item) => (
          <Link
            href={`/rankings/${item.slug}${query({ ...filters, page: 1 })}`}
            key={item.slug}
            aria-current={item.slug === currentSlug ? "page" : undefined}
          >
            {item.label.replace("2025-2026", "2025–2026")}
          </Link>
        ))}
      </nav>
      <form
        className="ranking-v6-filterbar"
        onSubmit={(e) => e.preventDefault()}
        role="search"
      >
        <label className="discovery-search-field">
          <span className="visually-hidden">{ui.search}</span>
          <DiscoveryIcon name="search" />
          <input
            type="search"
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder={ui.universitySearch}
          />
        </label>
        <label>
          <span>{design.countryShort}</span>
          <select
            value={filters.country}
            onChange={(e) => update({ country: e.target.value })}
          >
            <option value="">{design.allCountriesShort}</option>
            {countries.map((country) => (
              <option key={country}>{country}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{ui.topics}</span>
          <select
            value={filters.topic}
            onChange={(e) => update({ topic: e.target.value })}
          >
            <option value="">{ui.allTopics}</option>
            {discoveryPrimaryTopics.map((t) => (
              <option key={t} value={t}>
                {discoveryTopicLabel(t, locale)}
              </option>
            ))}
          </select>
        </label>
        <label className="ranking-v6-sort">
          <span>{ui.sort}</span>
          <select
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value })}
          >
            <option value="rank">
              {derived ? copy.derived : ui.rankOrder}
            </option>
            <option value="name">{ui.name}</option>
            <option value="recent">{copy.checked}</option>
          </select>
        </label>
      </form>
      {visible.length ? (
        <div className="ranking-v6-table-wrap">
          <table className="ranking-v6-table">
            <thead>
              <tr>
                <th scope="col">{derived ? copy.derived : copy.rank}</th>
                <th scope="col">{ui.universities}</th>
                <th scope="col">{design.location}</th>
                <th scope="col">{design.record}</th>
                <th scope="col">{design.actions}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((record) => (
                <tr key={record.slug} data-university={record.slug}>
                  <td
                    className="ranking-v6-position"
                    data-label={derived ? copy.derived : copy.rank}
                  >
                    <strong>{record.rankText}</strong>
                  </td>
                  <td className="ranking-v6-university">
                    <UniversityMark slug={record.slug} />
                    <Link href={`/universities/${record.slug}`}>
                      {record.name}
                    </Link>
                  </td>
                  <td
                    className="ranking-v6-location"
                    data-label={design.location}
                  >
                    {[record.region, record.country].filter(Boolean).join(", ")}
                  </td>
                  <td className="ranking-v6-policy">
                    <Link href={`/universities/${record.slug}#claims`}>
                      {design.currentRecord}
                    </Link>
                  </td>
                  <td className="ranking-v6-row-actions">
                    <Link href={`/universities/${record.slug}`}>
                      {ui.viewGuide} →
                    </Link>
                    <label>
                      <input
                        type="checkbox"
                        checked={filters.compare.includes(record.slug)}
                        disabled={
                          filters.compare.length >= 4 &&
                          !filters.compare.includes(record.slug)
                        }
                        onChange={() => toggle(record.slug)}
                        aria-label={`${ui.compare} ${record.name}`}
                      />
                      <span>{ui.compare}</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <DiscoveryEmpty
          locale={locale}
          onReset={() => update({ ...empty, compare: filters.compare })}
        />
      )}
      <div className="ranking-v6-table-footer">
        <p aria-live="polite">
          {ui.showing} {filtered.length ? (page - 1) * 5 + 1 : 0}–
          {Math.min(page * 5, filtered.length)} {ui.of}{" "}
          {filtered.length.toLocaleString(locale)}
        </p>
        {filters.q || filters.country || filters.topic ? (
          <button
            className="discovery-text-button"
            type="button"
            onClick={() => update({ ...empty, compare: filters.compare })}
          >
            {ui.reset}
          </button>
        ) : null}
        <DiscoveryPagination
          page={page}
          pageCount={pages}
          onPage={(page) => update({ page })}
          locale={locale}
        />
      </div>
      <DiscoveryCompareTray
        selected={filters.compare}
        names={names}
        locale={locale}
        onRemove={toggle}
        onClear={() => update({ compare: [], page: filters.page })}
      />
    </div>
  );
}
