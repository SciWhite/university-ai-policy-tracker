import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  type ClaimReviewState,
  type PublicEntitySummary
} from "@uapt/shared";
import { getPolicyAnalysisProfiles } from "./policy-analysis";
import { getAbsoluteSiteUrl } from "./site-url";
import { getStagedPublicDataset } from "./staged-public-data";

type EntityAliasKind =
  | "canonical_name"
  | "official_alias"
  | "slug"
  | "acronym"
  | "domain"
  | "ranking_label"
  | "location";

interface EntityAliasRecord {
  alias: string;
  kind: EntityAliasKind;
  lastReviewedAt?: string;
  matchConfidence: number;
  matchReason: string;
  normalizedAlias: string;
  reviewState: ClaimReviewState;
  sourceSystem: string;
}

interface EntityResolutionRecord {
  aliasCount: number;
  aliases: EntityAliasRecord[];
  canonicalUrl: string;
  claimCount: number;
  confidence?: number;
  country?: string;
  domainMatches: string[];
  entityName: string;
  entitySlug: string;
  entityType: "university";
  lastCheckedAt?: string;
  publicJsonUrl: string;
  rankingMatches: Array<{
    rankText: string;
    rankingSystem: string;
    rankingYear: number | string;
    sourceUrl?: string;
  }>;
  region?: string;
  reviewState: ClaimReviewState;
  sourceCount: number;
}

interface SearchIndexRecord {
  aliases: string[];
  canonicalUrl: string;
  claimCount: number;
  confidence?: number;
  country?: string;
  entityName: string;
  entitySlug: string;
  entityType: "university";
  fields: {
    analysisDimensions: string[];
    claimSummaries: string[];
    sourceTitles: string[];
    summary?: string;
  };
  lastCheckedAt?: string;
  publicJsonUrl: string;
  region?: string;
  reviewState: ClaimReviewState;
  searchTokens: string[];
  sourceCount: number;
}

export interface EntitySearchResult {
  canonicalUrl: string;
  claimCount: number;
  confidence?: number;
  entityName: string;
  entitySlug: string;
  lastCheckedAt?: string;
  matchReason: string;
  matchedAliases: string[];
  matchedFields: string[];
  publicJsonUrl: string;
  reviewState: ClaimReviewState;
  score: number;
  sourceBackedSnippet: string;
  sourceCount: number;
}

interface SearchOptions {
  limit?: number;
}

export async function getEntityResolutionIndexResponse() {
  const records = await getEntityResolutionRecords();
  const canonicalUrl = getAbsoluteSiteUrl("/search");
  const publicJsonUrl = getAbsoluteSiteUrl(
    `/api/public/${PUBLIC_API_VERSION}/entities/index.json`
  );

  return {
    apiVersion: PUBLIC_API_VERSION,
    generatedAt: new Date().toISOString(),
    canonicalUrl,
    publicJsonUrl,
    license: TRACKER_METADATA_LICENSE,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: [
      "Entity aliases improve recall only. They do not create new policy facts.",
      "Reference-sheet and ranking matches remain non-authoritative unless independently tied to official source evidence.",
      NO_ADVICE_BOUNDARY
    ],
    data: {
      count: records.length,
      aliasCount: records.reduce((total, record) => total + record.aliasCount, 0),
      records
    }
  };
}

export async function getSearchIndexResponse() {
  const records = await getSearchIndexRecords();
  const canonicalUrl = getAbsoluteSiteUrl("/search");
  const publicJsonUrl = getAbsoluteSiteUrl(
    `/api/public/${PUBLIC_API_VERSION}/search/index.json`
  );

  return {
    apiVersion: PUBLIC_API_VERSION,
    generatedAt: new Date().toISOString(),
    canonicalUrl,
    publicJsonUrl,
    license: TRACKER_METADATA_LICENSE,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: [
      "This safe search index includes promoted public record metadata only.",
      "Search snippets use summaries, source titles, claim text, and analysis labels, not raw source snapshots or unpublished staging artifacts.",
      NO_ADVICE_BOUNDARY
    ],
    data: {
      count: records.length,
      indexPolicy: {
        indexed:
          "universities, aliases, official source titles, claim summaries, analysis dimensions, changes-linked public records",
        excluded:
          "raw source snapshots, raw PDFs, private files, unpromoted staging evidence, non-authoritative spreadsheet rows as policy evidence",
        pagefindReady:
          "The records are safe to feed into a future static Pagefind build without exposing unpublished artifacts."
      },
      records
    }
  };
}

export async function getSearchResponse(query: string, options: SearchOptions = {}) {
  const results = await searchEntities(query, options);
  const canonicalUrl = getAbsoluteSiteUrl(
    query ? `/search?q=${encodeURIComponent(query)}` : "/search"
  );
  const publicJsonUrl = getAbsoluteSiteUrl(
    `/api/public/${PUBLIC_API_VERSION}/search.json?q=${encodeURIComponent(query)}`
  );

  return {
    apiVersion: PUBLIC_API_VERSION,
    generatedAt: new Date().toISOString(),
    canonicalUrl,
    publicJsonUrl,
    license: TRACKER_METADATA_LICENSE,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: [
      "Search matches are routing aids over public records and aliases. They are not policy conclusions.",
      "Open canonical records for source URLs, review state, confidence, and original-language evidence.",
      NO_ADVICE_BOUNDARY
    ],
    data: {
      query,
      count: results.length,
      results
    }
  };
}

export async function searchEntities(
  query: string,
  { limit = 20 }: SearchOptions = {}
): Promise<EntitySearchResult[]> {
  const normalizedQuery = normalizeForSearch(query);
  if (!normalizedQuery) return [];

  const queryTokens = tokenize(normalizedQuery);
  const records = await getSearchIndexRecords();
  const results = records
    .map((record) => scoreRecord(record, normalizedQuery, queryTokens))
    .filter((result): result is EntitySearchResult => Boolean(result))
    .sort((left, right) => right.score - left.score || left.entityName.localeCompare(right.entityName))
    .slice(0, clampLimit(limit));

  return results;
}

export async function getEntityResolutionRecords(): Promise<
  EntityResolutionRecord[]
> {
  const dataset = await getStagedPublicDataset();
  const catalogBySlug = new Map(
    dataset.catalogUniversities.map((university) => [university.slug, university])
  );

  return dataset.publicSummaries.map((summary) => {
    const catalog = catalogBySlug.get(summary.entity.slug);
    const domains = getDomainAliases(summary);
    const aliases = buildAliasRecords(summary, domains);

    return {
      entityType: "university",
      entitySlug: summary.entity.slug,
      entityName: summary.entity.name,
      canonicalUrl: summary.canonicalUrl,
      publicJsonUrl:
        summary.apiUrl ??
        getAbsoluteSiteUrl(
          `/api/public/${PUBLIC_API_VERSION}/universities/${summary.entity.slug}.json`
        ),
      reviewState: summary.reviewState,
      confidence: summary.confidence,
      lastCheckedAt: summary.lastCheckedAt,
      claimCount: summary.claims.length,
      sourceCount: summary.officialSources.length,
      country: catalog?.country,
      region: catalog?.region,
      domainMatches: domains,
      rankingMatches:
        catalog?.rankings.map((ranking) => ({
          rankingSystem: ranking.systemName,
          rankingYear: ranking.rankingYear,
          rankText: ranking.rankText,
          sourceUrl: ranking.sourceUrl
        })) ?? [],
      aliases,
      aliasCount: aliases.length
    };
  });
}

async function getSearchIndexRecords(): Promise<SearchIndexRecord[]> {
  const [dataset, profiles] = await Promise.all([
    getStagedPublicDataset(),
    getPolicyAnalysisProfiles()
  ]);
  const catalogBySlug = new Map(
    dataset.catalogUniversities.map((university) => [university.slug, university])
  );
  const profileBySlug = new Map(
    profiles.map((profile) => [profile.entitySlug, profile])
  );

  return dataset.publicSummaries.map((summary) => {
    const catalog = catalogBySlug.get(summary.entity.slug);
    const aliases = buildAliasRecords(summary, getDomainAliases(summary)).map(
      (alias) => alias.alias
    );
    const profile = profileBySlug.get(summary.entity.slug);
    const sourceTitles = summary.officialSources.map(
      (source) => source.citationTitle
    );
    const claimSummaries = summary.claims.map((claim) => claim.claimText);
    const analysisDimensions =
      profile?.dimensions.map((dimension) => dimension.label) ?? [];
    const searchTokens = tokenize(
      [
        summary.entity.slug,
        summary.entity.name,
        summary.summary,
        catalog?.country,
        catalog?.region,
        ...aliases,
        ...sourceTitles,
        ...claimSummaries,
        ...analysisDimensions
      ]
        .filter((value): value is string => Boolean(value))
        .join(" ")
    );

    return {
      entityType: "university",
      entitySlug: summary.entity.slug,
      entityName: summary.entity.name,
      canonicalUrl: summary.canonicalUrl,
      publicJsonUrl:
        summary.apiUrl ??
        getAbsoluteSiteUrl(
          `/api/public/${PUBLIC_API_VERSION}/universities/${summary.entity.slug}.json`
        ),
      reviewState: summary.reviewState,
      confidence: summary.confidence,
      lastCheckedAt: summary.lastCheckedAt,
      claimCount: summary.claims.length,
      sourceCount: summary.officialSources.length,
      country: catalog?.country,
      region: catalog?.region,
      aliases,
      fields: {
        summary: summary.summary,
        sourceTitles,
        claimSummaries,
        analysisDimensions
      },
      searchTokens
    };
  });
}

function buildAliasRecords(
  summary: PublicEntitySummary,
  domains: string[]
): EntityAliasRecord[] {
  const aliases: EntityAliasRecord[] = [];
  const reviewedAt = summary.lastCheckedAt ?? summary.lastChangedAt;
  const addAlias = (
    alias: string | undefined,
    kind: EntityAliasKind,
    sourceSystem: string,
    matchConfidence: number,
    matchReason: string,
    reviewState: ClaimReviewState = "machine_candidate"
  ) => {
    if (!alias) return;
    const normalizedAlias = normalizeForSearch(alias);
    if (!normalizedAlias) return;
    if (aliases.some((existing) => existing.normalizedAlias === normalizedAlias)) {
      return;
    }
    aliases.push({
      alias,
      kind,
      normalizedAlias,
      sourceSystem,
      matchConfidence,
      matchReason,
      reviewState,
      lastReviewedAt: reviewedAt
    });
  };

  addAlias(
    summary.entity.name,
    "canonical_name",
    "public_entity_summary",
    1,
    "Canonical public entity name.",
    summary.reviewState
  );
  addAlias(
    summary.entity.slug,
    "slug",
    "public_entity_summary",
    0.98,
    "Canonical public slug.",
    summary.reviewState
  );
  addAlias(
    summary.entity.slug.replace(/-/g, " "),
    "slug",
    "public_entity_summary",
    0.96,
    "Canonical public slug rendered as words.",
    summary.reviewState
  );

  for (const alias of summary.entity.aliases) {
    addAlias(
      alias,
      "official_alias",
      "public_entity_summary",
      0.94,
      "Alias published in the public entity summary.",
      summary.reviewState
    );
  }

  for (const acronym of buildAcronymAliases(summary.entity.name)) {
    addAlias(
      acronym,
      "acronym",
      "derived_alias",
      0.82,
      "Acronym derived from the public entity name."
    );
  }

  for (const domain of domains) {
    addAlias(
      domain,
      "domain",
      "official_source_domain",
      0.78,
      "Domain derived from promoted official source URLs."
    );
  }

  for (const alias of summary.entity.aliases.filter((value) =>
    /^QS\s+2026/i.test(value)
  )) {
    addAlias(
      alias,
      "ranking_label",
      "ranking_metadata",
      0.72,
      "Ranking label is a retrieval hint, not policy evidence."
    );
  }

  return aliases.sort((left, right) => {
    if (right.matchConfidence !== left.matchConfidence) {
      return right.matchConfidence - left.matchConfidence;
    }
    return left.alias.localeCompare(right.alias);
  });
}

function scoreRecord(
  record: SearchIndexRecord,
  normalizedQuery: string,
  queryTokens: string[]
): EntitySearchResult | undefined {
  const name = normalizeForSearch(record.entityName);
  const slug = normalizeForSearch(record.entitySlug);
  const aliasMatches = record.aliases.filter((alias) =>
    textMatchesNormalized(alias, normalizedQuery)
  );
  const exactAliasMatches = record.aliases.filter(
    (alias) => normalizeForSearch(alias) === normalizedQuery
  );
  const matchedFields: string[] = [];
  let score = 0;
  let matchReason = "Token match in public record metadata.";

  if (normalizedQuery === slug) {
    score += 110;
    matchedFields.push("slug");
    matchReason = "Exact canonical slug match.";
  }
  if (normalizedQuery === name) {
    score += 105;
    matchedFields.push("name");
    matchReason = "Exact canonical name match.";
  } else if (textMatchesNormalized(record.entityName, normalizedQuery)) {
    score += 80;
    matchedFields.push("name");
    matchReason = "Canonical name contains the query.";
  }
  if (exactAliasMatches.length) {
    score += 95;
    matchedFields.push("alias");
    matchReason = "Exact entity alias match.";
  } else if (aliasMatches.length) {
    score += 72;
    matchedFields.push("alias");
    matchReason = "Entity alias contains the query.";
  }

  const fieldMatches = getFieldMatches(record, normalizedQuery);
  score += fieldMatches.score;
  matchedFields.push(...fieldMatches.fields);
  if (fieldMatches.reason && score < 80) matchReason = fieldMatches.reason;

  const matchingTokens = queryTokens.filter((token) =>
    record.searchTokens.includes(token)
  );
  score += matchingTokens.length * 9;

  if (score <= 0) return undefined;

  return {
    entitySlug: record.entitySlug,
    entityName: record.entityName,
    canonicalUrl: record.canonicalUrl,
    publicJsonUrl: record.publicJsonUrl,
    reviewState: record.reviewState,
    confidence: record.confidence,
    lastCheckedAt: record.lastCheckedAt,
    claimCount: record.claimCount,
    sourceCount: record.sourceCount,
    score,
    matchedAliases: [...exactAliasMatches, ...aliasMatches].slice(0, 5),
    matchedFields: Array.from(new Set(matchedFields)).slice(0, 6),
    matchReason,
    sourceBackedSnippet: chooseSnippet(record, normalizedQuery)
  };
}

function getFieldMatches(
  record: SearchIndexRecord,
  normalizedQuery: string
): { fields: string[]; reason?: string; score: number } {
  const matches: string[] = [];
  let score = 0;
  let reason: string | undefined;

  if (textMatchesNormalized(record.fields.summary ?? "", normalizedQuery)) {
    matches.push("summary");
    score += 42;
    reason = "Public record summary contains the query.";
  }
  if (
    record.fields.sourceTitles.some((title) =>
      textMatchesNormalized(title, normalizedQuery)
    )
  ) {
    matches.push("official_source_title");
    score += 38;
    reason = "Promoted official source title contains the query.";
  }
  if (
    record.fields.claimSummaries.some((claim) =>
      textMatchesNormalized(claim, normalizedQuery)
    )
  ) {
    matches.push("claim_summary");
    score += 34;
    reason = "Public source-backed claim text contains the query.";
  }
  if (
    record.fields.analysisDimensions.some((dimension) =>
      textMatchesNormalized(dimension, normalizedQuery)
    )
  ) {
    matches.push("analysis_dimension");
    score += 24;
    reason = "Analysis dimension label contains the query.";
  }

  return { fields: matches, reason, score };
}

function chooseSnippet(
  record: SearchIndexRecord,
  normalizedQuery: string
): string {
  const candidates = [
    record.fields.summary,
    ...record.fields.sourceTitles,
    ...record.fields.claimSummaries,
    ...record.fields.analysisDimensions
  ].filter((value): value is string => Boolean(value));
  const matched = candidates.find((value) =>
    textMatchesNormalized(value, normalizedQuery)
  );

  return matched ?? record.fields.summary ?? "Open the canonical record for details.";
}

function getDomainAliases(summary: PublicEntitySummary): string[] {
  const domains = new Set<string>();
  for (const source of summary.officialSources) {
    try {
      const hostname = new URL(source.sourceUrl).hostname.replace(/^www\./, "");
      domains.add(hostname);
      const parts = hostname.split(".");
      if (parts.length > 2) domains.add(parts.slice(-2).join("."));
    } catch {
      // Ignore malformed URLs already rejected elsewhere.
    }
  }

  return Array.from(domains).sort();
}

function buildAcronymAliases(name: string): string[] {
  const aliases = new Set<string>();
  for (const match of name.matchAll(/\(([^)]+)\)/g)) {
    const value = match[1].trim();
    if (/^[A-Za-z][A-Za-z0-9&.-]{1,12}$/.test(value)) aliases.add(value);
  }

  const words = name
    .replace(/\([^)]*\)/g, "")
    .replace(/[–—-]/g, " ")
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word))
    .filter((word) => !/^(of|the|and|for|in|at)$/i.test(word));
  const acronym = words.map((word) => word[0].toUpperCase()).join("");
  if (acronym.length >= 2 && acronym.length <= 8) aliases.add(acronym);

  return Array.from(aliases);
}

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenize(value: string): string[] {
  return Array.from(
    new Set(
      normalizeForSearch(value)
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length > 1)
    )
  );
}

function textMatchesNormalized(value: string, normalizedQuery: string): boolean {
  if (normalizedQuery.length <= 3) {
    return tokenize(value).includes(normalizedQuery);
  }

  return normalizeForSearch(value).includes(normalizedQuery);
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) return 20;

  return Math.max(1, Math.min(Math.trunc(value), 50));
}
