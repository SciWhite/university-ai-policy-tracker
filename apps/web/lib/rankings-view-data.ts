import { countryKey, countryLabel } from "./discovery-location";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { findRepoRoot } from "./repo-root";
import { getStaticUniversityIndexRecords } from "./university-index-records";
import { getStagedPublicDataset } from "./staged-public-data";
import { getDiscoveryTopicKeys } from "./discovery-topic-groups";
import {
  getInstitutionLocalizedAliasesByLocale,
  getLocalizedInstitutionName,
} from "./institution-localization";
import { normalizeForSearch, textMatchesNormalized } from "./search-text";
import { getRankingEdition, rankingEditions } from "./ranking-editions";
import {
  parseDiscoveryQuery,
  type DiscoveryMode,
  type DiscoverySearchParams,
} from "./discovery-query";
import type { SupportedLocale } from "./i18n";

interface SourceRow {
  id: string;
  name: string;
  country: string;
  region: string;
  rankText: string;
  rankNumber: number | null;
  rowNumber: number;
  sourceId: string;
  sourceUrl: string;
}
interface SourceDocument {
  edition: string;
  systemId: string;
  year: string;
  sourceUrl: string;
  sourceSha256: string;
  rankType: string;
  unrankedCount?: number;
  rows: SourceRow[];
}
export interface RankingViewRow extends SourceRow {
  slug: string;
  edition: string;
  topics: string[];
  lastCheckedAt?: string;
  reviewState?: string;
  claimCount: number;
  reviewedClaimCount: number;
  sourceCount: number;
  summary?: string;
  identityStatus: "linked" | "pending";
}
const readEdition = cache(async (slug: string): Promise<SourceDocument> => {
  if (!getRankingEdition(slug)) throw new Error("Unknown ranking edition");
  return JSON.parse(
    await readFile(
      path.join(await findRepoRoot(), "data/ranking-browser", `${slug}.json`),
      "utf8",
    ),
  );
});
const normalizeName = (name: string) =>
  name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
const normalizeCountry = countryKey;
const getPolicyBasis = cache(async () => {
  const [records, dataset] = await Promise.all([
    getStaticUniversityIndexRecords(),
    getStagedPublicDataset(),
  ]);
  const topics = new Map(
    dataset.publicSummaries.map((r) => [
      r.entity.slug,
      [...new Set(r.claims.flatMap(getDiscoveryTopicKeys))],
    ]),
  );
  const bySlug = new Map(records.map((r) => [r.slug, r]));
  const links: {
    links: Array<{
      edition: string;
      sourceId: string;
      sourceName: string;
      country: string;
      slug: string;
    }>;
  } = JSON.parse(
    await readFile(
      path.join(
        await findRepoRoot(),
        "data/ranking-browser/identity-links.json",
      ),
      "utf8",
    ),
  );
  const explicitLinks = new Map(
    links.links.map((link) => [link.edition + ":" + link.sourceId, link]),
  );
  // Accepted legacy bindings supply explicit source names, never fuzzy candidates.
  const names = new Map<string, Set<string>>();
  const add = (name: string, country: string, slug: string) => {
    if (!name || !country) return;
    const key = normalizeName(name) + "|" + normalizeCountry(country);
    const set = names.get(key) ?? new Set<string>();
    set.add(slug);
    names.set(key, set);
  };
  for (const r of records)
    for (const n of [r.name, ...(r.aliases ?? [])]) add(n, r.country, r.slug);
  const oldEditions = rankingEditions.filter((e) =>
    [
      "qs-2026",
      "the-2026",
      "arwu-2025",
      "usnews-2025-2026",
      "cwts-leiden-2025",
    ].includes(e.slug),
  );
  const old = await Promise.all(oldEditions.map((e) => readEdition(e.slug)));
  const persistent = new Map<string, Set<string>>();
  const acceptedSourceRows = new Map<string, Set<string>>();
  for (const doc of old) {
    const byRow = new Map(doc.rows.map((r) => [r.rowNumber, r]));
    for (const record of records) {
      const rank = record.rankings.find(
        (r) =>
          r.systemId === doc.systemId && String(r.rankingYear) === doc.year,
      );
      const source = rank && byRow.get(rank.rowNumber);
      if (!source) continue;
      // Validate the frozen accepted row binding before using its name/ID.
      if (source.rankText !== rank.rankText) continue;
      if (
        source.country &&
        normalizeCountry(source.country) !== normalizeCountry(record.country)
      )
        continue;
      add(source.name, source.country || record.country, record.slug);
      const rowKey = doc.edition + ":" + source.rowNumber;
      const accepted = acceptedSourceRows.get(rowKey) ?? new Set<string>();
      accepted.add(record.slug);
      acceptedSourceRows.set(rowKey, accepted);
      if (source.sourceId) {
        const key = doc.systemId + ":" + source.sourceId;
        const set = persistent.get(key) ?? new Set<string>();
        set.add(record.slug);
        persistent.set(key, set);
      }
    }
  }
  return {
    records,
    topics,
    bySlug,
    names,
    persistent,
    acceptedSourceRows,
    explicitLinks,
  };
});
const getEditionRows = cache(async (slug: string) => {
  const [doc, basis] = await Promise.all([readEdition(slug), getPolicyBasis()]);
  const rows = doc.rows.map((source): RankingViewRow => {
    const key =
      normalizeName(source.name) + "|" + normalizeCountry(source.country);
    const byName = basis.names.get(key),
      byId = source.sourceId
        ? basis.persistent.get(doc.systemId + ":" + source.sourceId)
        : undefined;
    const explicit = basis.explicitLinks.get(
      doc.edition + ":" + source.sourceId,
    );
    const reviewedSlug =
      explicit &&
      explicit.sourceName === source.name &&
      countryKey(explicit.country) === countryKey(source.country) &&
      basis.bySlug.has(explicit.slug)
        ? explicit.slug
        : undefined;
    const candidates = new Set([
      ...(reviewedSlug ? [reviewedSlug] : []),
      ...(byName ?? []),
      ...(byId ?? []),
      ...(basis.acceptedSourceRows.get(doc.edition + ":" + source.rowNumber) ??
        []),
    ]);
    const candidate =
      candidates.size === 1 ? basis.bySlug.get([...candidates][0]) : undefined;
    const record =
      candidate &&
      (!source.country ||
        normalizeCountry(source.country) ===
          normalizeCountry(candidate.country))
        ? candidate
        : undefined;
    return {
      ...source,
      slug: record?.slug ?? "",
      edition: slug,
      country: source.country || record?.country || "",
      identityStatus: record ? "linked" : "pending",
      topics: record ? (basis.topics.get(record.slug) ?? []) : [],
      lastCheckedAt: record?.lastCheckedAt,
      reviewState: record?.reviewState,
      claimCount: record?.claimCount ?? 0,
      reviewedClaimCount: record?.reviewedClaimCount ?? 0,
      sourceCount: record?.sourceCount ?? 0,
    };
  });
  const slugCounts = new Map<string, number>();
  for (const row of rows)
    if (row.slug) slugCounts.set(row.slug, (slugCounts.get(row.slug) ?? 0) + 1);
  return {
    doc,
    rows: rows.map((row) =>
      row.slug && slugCounts.get(row.slug)! > 1
        ? {
            ...row,
            slug: "",
            identityStatus: "pending" as const,
            topics: [],
            lastCheckedAt: undefined,
            reviewState: undefined,
            claimCount: 0,
            reviewedClaimCount: 0,
            sourceCount: 0,
          }
        : row,
    ),
  };
});
export async function getDiscoveryPage(
  mode: DiscoveryMode,
  input: DiscoverySearchParams,
  locale: SupportedLocale,
  fixedEdition?: string,
) {
  const query = parseDiscoveryQuery(input, mode, fixedEdition);
  const [{ doc, rows: rankingRows }, basis] = await Promise.all([
    getEditionRows(query.edition),
    getPolicyBasis(),
  ]);
  const ranksBySlug = new Map<string, RankingViewRow>();
  for (const row of rankingRows)
    if (row.slug && !ranksBySlug.has(row.slug)) ranksBySlug.set(row.slug, row);
  const policyRows: RankingViewRow[] =
    mode === "universities"
      ? basis.records.map((record) => {
          const rank = ranksBySlug.get(record.slug);
          return {
            ...(rank ?? {
              id: "policy:" + record.slug,
              rankText: "—",
              rankNumber: null,
              rowNumber: 0,
              sourceId: "",
              sourceUrl: "",
            }),
            slug: record.slug,
            name: record.name,
            country: record.country,
            region: record.region,
            edition: query.edition,
            identityStatus: "linked",
            topics: basis.topics.get(record.slug) ?? [],
            lastCheckedAt: record.lastCheckedAt,
            reviewState: record.reviewState,
            claimCount: record.claimCount,
            reviewedClaimCount: record.reviewedClaimCount,
            sourceCount: record.sourceCount,
            summary: record.summary,
          };
        })
      : [];
  const rows =
    mode === "rankings"
      ? rankingRows
      : [...policyRows, ...rankingRows.filter((r) => !r.slug)];
  const countries = [
    ...new Set(rows.map((r) => countryLabel(r.country)).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, locale));
  query.country = countryLabel(query.country);
  const q = normalizeForSearch(query.q);
  const filtered = rows.filter(
    (r) =>
      (!query.country || countryKey(r.country) === countryKey(query.country)) &&
      query.topics.every((t) => r.topics.includes(t)) &&
      (query.scope !== "policy" || r.claimCount > 0) &&
      (query.scope !== "ranking-only" || !r.slug) &&
      (query.coverage !== "ranked" || r.rankNumber !== null) &&
      (query.coverage !== "missing" || r.rankNumber === null) &&
      (!q ||
        textMatchesNormalized(
          [
            r.name,
            r.country,
            countryLabel(r.country),
            r.region,
            r.slug,
            ...(r.slug
              ? getInstitutionLocalizedAliasesByLocale(r.slug, locale)
              : []),
          ].join(" "),
          q,
        )),
  );
  filtered.sort((a, b) => {
    let v = 0;
    if (query.sort === "rank") {
      if (a.rankNumber === null || b.rankNumber === null)
        return a.rankNumber === b.rankNumber
          ? a.name.localeCompare(b.name, locale)
          : a.rankNumber === null
            ? 1
            : -1;
      v = a.rankNumber - b.rankNumber;
    } else if (query.sort === "recent") {
      if (!a.lastCheckedAt || !b.lastCheckedAt)
        return a.lastCheckedAt === b.lastCheckedAt
          ? a.name.localeCompare(b.name, locale)
          : a.lastCheckedAt
            ? -1
            : 1;
      v =
        (Date.parse(a.lastCheckedAt) || 0) - (Date.parse(b.lastCheckedAt) || 0);
    } else if (query.sort === "claims") v = a.claimCount - b.claimCount;
    else if (query.sort === "sources") v = a.sourceCount - b.sourceCount;
    else
      v = getLocalizedInstitutionName(a.slug, a.name, locale).localeCompare(
        getLocalizedInstitutionName(b.slug, b.name, locale),
        locale,
      );
    return (
      v * (query.order === "desc" ? -1 : 1) ||
      a.rowNumber - b.rowNumber ||
      a.name.localeCompare(b.name, locale)
    );
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / query.size));
  query.page = Math.min(query.page, pageCount);
  return {
    query,
    rows: filtered.slice(
      (query.page - 1) * query.size,
      query.page * query.size,
    ),
    total: filtered.length,
    pageCount,
    countries,
    rankingCount: rankingRows.length,
    policyCount: basis.records.length,
    linkedCount: rankingRows.filter((r) => r.slug).length,
    unrankedCount: doc.unrankedCount ?? 0,
    sourceUrl: doc.sourceUrl,
    sourceSha256: doc.sourceSha256,
    compareNames: Object.fromEntries(
      query.compare.flatMap((slug) => {
        const r = basis.bySlug.get(slug);
        return r ? [[slug, r.name]] : [];
      }),
    ),
  };
}
export type DiscoveryPageData = Awaited<ReturnType<typeof getDiscoveryPage>>;
