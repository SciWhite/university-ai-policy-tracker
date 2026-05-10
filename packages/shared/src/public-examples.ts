import {
  DEFAULT_PUBLIC_SITE_BASE_URL,
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  claimReviewStateSchema,
  publicApiIndexDataSchema,
  publicApiIndexResponseSchema,
  publicEntitySummaryResponseSchema,
  publicEntitySummarySchema,
  publicRecentChangesDataSchema,
  publicRecentChangesEnvelopeSchema,
  publicRecentChangesResponseSchema,
  publicUniversityListDataSchema,
  publicUniversityListResponseSchema,
  type ClaimReviewState,
  type PublicApiIndexData,
  type PublicApiIndexResponse,
  type PublicApiCitation,
  type PublicEntitySummaryResponse,
  type PublicEntitySummary,
  type PublicRecentChangesData,
  type PublicRecentChangesEnvelope,
  type PublicRecentChangesResponse,
  type PublicUniversityListData,
  type PublicUniversityListResponse,
  type SourceAttribution
} from "./claims";
import type { SeedPolicySource, SeedUniversity } from "./schemas";
import { seedUniversities } from "./seed";

export function buildSeedPublicEntitySummary(
  university: SeedUniversity,
  siteBaseUrl = DEFAULT_PUBLIC_SITE_BASE_URL
): PublicEntitySummary {
  const canonicalUrl = new URL(`/universities/${university.slug}`, siteBaseUrl)
    .toString();
  const officialSources = university.sources.map((source) =>
    buildSeedSourceAttribution(university, source)
  );
  const claims = university.sources.map((source, index) => {
    const attribution = officialSources[index];

    return {
      entitySlug: university.slug,
      entityType: "university" as const,
      claimType: "source_status" as const,
      claimText:
        `${university.name} has a cataloged AI policy source titled ` +
        `"${source.title}". Policy conclusions remain pending review unless a ` +
        "claim is marked agent_reviewed or human_reviewed.",
      confidence: 0.25,
      reviewState: normalizeClaimReviewState(source.reviewState),
      lastCheckedAt: source.lastCheckedAt,
      lastChangedAt: source.lastChangedAt,
      evidence: [
        {
          sourceUrl: source.url,
          sourceLanguage: "en",
          sourceSnapshotHash: attribution.snapshotHash,
          evidenceSnippet:
            `Seed catalog record: ${source.title}. This local example is a ` +
            "contract placeholder, not a reviewed policy conclusion.",
          evidenceSnippetDisplay:
            "Display helper: local seed metadata only. Original evidence remains canonical.",
          retrievedAt: source.lastCheckedAt,
          attribution
        }
      ]
    };
  });
  const parsedClaims = claims.map((claim) => claim);
  const lastCheckedAt = latestIso(
    university.sources.map((source) => source.lastCheckedAt)
  );
  const lastChangedAt = latestIso(
    university.sources.map((source) => source.lastChangedAt ?? source.lastCheckedAt)
  );

  return publicEntitySummarySchema.parse({
    schemaVersion: PUBLIC_API_VERSION,
    citationTitle: `${university.name} AI Policy Tracker record`,
    canonicalUrl,
    publicPageUrl: canonicalUrl,
    apiUrl: new URL(
      `/api/public/${PUBLIC_API_VERSION}/universities/${university.slug}.json`,
      siteBaseUrl
    ).toString(),
    entityType: "university",
    entitySlug: university.slug,
    entity: {
      type: "university",
      slug: university.slug,
      name: university.name,
      canonicalUrl,
      aliases: [],
      summary: university.summary
    },
    summary: university.summary,
    lastCheckedAt,
    lastChangedAt,
    confidence: parsedClaims.length
      ? Math.max(...parsedClaims.map((claim) => claim.confidence))
      : undefined,
    reviewState: aggregateReviewState(
      parsedClaims.map((claim) => claim.reviewState)
    ),
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: [NO_ADVICE_BOUNDARY],
    officialSources,
    claims: parsedClaims,
    suggestedCitation: buildSuggestedCitation(
      university.name,
      canonicalUrl,
      lastCheckedAt
    )
  });
}

export function buildSeedPublicEntitySummaries(
  siteBaseUrl = DEFAULT_PUBLIC_SITE_BASE_URL
): PublicEntitySummary[] {
  return seedUniversities.map((university) =>
    buildSeedPublicEntitySummary(university, siteBaseUrl)
  );
}

export function buildPublicApiIndexData(
  siteBaseUrl = DEFAULT_PUBLIC_SITE_BASE_URL
): PublicApiIndexData {
  const endpoint = (
    label: string,
    path: string,
    description: string,
    templatePath?: string
  ) => ({
    label,
    path,
    templatePath,
    url: new URL(path, siteBaseUrl).toString(),
    description
  });
  const trustPage = (label: string, path: string, description: string) => ({
    label,
    path,
    url: new URL(path, siteBaseUrl).toString(),
    description
  });

  return publicApiIndexDataSchema.parse({
    name: "University AI Policy Tracker public API",
    purpose:
      "Citation-first, source-backed public JSON for university AI policy records.",
    apiVersion: PUBLIC_API_VERSION,
    canonicalSiteUrl: new URL("/", siteBaseUrl).toString(),
    endpoints: [
      endpoint(
        "API index",
        `/api/public/${PUBLIC_API_VERSION}/index.json`,
        "Manifest for public v1 JSON endpoints and trust pages."
      ),
      endpoint(
        "Universities list",
        `/api/public/${PUBLIC_API_VERSION}/universities.json`,
        "List of public university records with canonical page and JSON links."
      ),
      endpoint(
        "University record",
        `/api/public/${PUBLIC_API_VERSION}/universities/harvard.json`,
        "One citation-ready university record with claims, evidence, sources, and review state.",
        `/api/public/${PUBLIC_API_VERSION}/universities/{slug}.json`
      ),
      endpoint(
        "Recent changes",
        `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`,
        "Recent public source checks and changed institution records."
      ),
      endpoint(
        "Dataset release manifest",
        `/api/public/${PUBLIC_API_VERSION}/datasets/latest.json`,
        "Latest dataset release manifest with artifact URLs, row counts, byte sizes, and SHA-256 checksums."
      ),
      endpoint(
        "Universities JSONL",
        `/api/public/${PUBLIC_API_VERSION}/datasets/universities.jsonl`,
        "Bulk JSONL export with one public university record per line."
      ),
      endpoint(
        "Claims JSONL",
        `/api/public/${PUBLIC_API_VERSION}/datasets/claims.jsonl`,
        "Bulk JSONL export with one claim-level evidence record per line."
      ),
      endpoint(
        "Sources JSONL",
        `/api/public/${PUBLIC_API_VERSION}/datasets/sources.jsonl`,
        "Bulk JSONL export with one source attribution record per line."
      ),
      endpoint(
        "Changes JSONL",
        `/api/public/${PUBLIC_API_VERSION}/datasets/changes.jsonl`,
        "Bulk JSONL export with one public change or freshness record per line."
      ),
      endpoint(
        "Dataset checksums",
        `/api/public/${PUBLIC_API_VERSION}/datasets/checksums.txt`,
        "SHA-256 checksums for bulk dataset artifacts."
      ),
      endpoint(
        "Dataset data dictionary",
        `/api/public/${PUBLIC_API_VERSION}/datasets/data-dictionary.md`,
        "Markdown data dictionary for the public dataset release."
      )
    ],
    trustPages: [
      trustPage(
        "Methodology",
        "/methodology",
        "Evidence, snapshot, claim extraction, review, and limitation methodology."
      ),
      trustPage(
        "Citation",
        "/citation",
        "Citation formats, source rights caveats, and public JSON field guidance."
      ),
      trustPage(
        "Datasets",
        "/datasets",
        "Dataset access surface, licensing expectations, and JSON endpoint links."
      ),
      trustPage(
        "Changes",
        "/changes",
        "Recent public changes and freshness records."
      )
    ],
    citationRules: [
      "Cite the canonical page URL and versioned public JSON URL together.",
      "Retain source URL, source language, source snapshot hash, review state, confidence, and original evidence snippet for claim reuse.",
      "Original-language evidence is canonical; localized summaries are display helpers only."
    ],
    limitations: [NO_ADVICE_BOUNDARY]
  });
}

export function buildPublicUniversityListData(
  summaries: PublicEntitySummary[]
): PublicUniversityListData {
  return publicUniversityListDataSchema.parse({
    count: summaries.length,
    universities: summaries.map((summary) => ({
      entitySlug: summary.entity.slug,
      entityName: summary.entity.name,
      entityType: summary.entity.type,
      citationTitle: summary.citationTitle,
      canonicalUrl: summary.canonicalUrl,
      publicPageUrl: summary.publicPageUrl ?? summary.canonicalUrl,
      publicJsonUrl:
        summary.apiUrl ??
        new URL(
          `/api/public/${PUBLIC_API_VERSION}/universities/${summary.entity.slug}.json`,
          summary.canonicalUrl
        ).toString(),
      summary: summary.summary,
      lastCheckedAt: summary.lastCheckedAt,
      lastChangedAt: summary.lastChangedAt,
      reviewState: summary.reviewState,
      confidence: summary.confidence,
      claimCount: summary.claims.length,
      officialSourceCount: summary.officialSources.length
    }))
  });
}

export function buildPublicRecentChangesData(
  summaries: PublicEntitySummary[]
): PublicRecentChangesData {
  return publicRecentChangesDataSchema.parse({
    changes: summaries.map((summary) => ({
      entitySlug: summary.entity.slug,
      entityName: summary.entity.name,
      canonicalUrl: summary.canonicalUrl,
      citationTitle: summary.citationTitle,
      lastCheckedAt: summary.lastCheckedAt,
      lastChangedAt: summary.lastChangedAt,
      reviewState: summary.reviewState,
      claimCount: summary.claims.length,
      claims: summary.claims
    }))
  });
}

export function buildPublicApiCitation(input: {
  citationTitle: string;
  canonicalUrl: string;
  publicJsonUrl: string;
  suggestedCitation: string;
}): PublicApiCitation {
  return {
    citationTitle: input.citationTitle,
    canonicalUrl: input.canonicalUrl,
    publicJsonUrl: input.publicJsonUrl,
    suggestedCitation: input.suggestedCitation,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT
  };
}

export function buildPublicApiIndexResponse(
  siteBaseUrl = DEFAULT_PUBLIC_SITE_BASE_URL,
  generatedAt = new Date().toISOString()
): PublicApiIndexResponse {
  const canonicalUrl = new URL("/datasets", siteBaseUrl).toString();
  const publicJsonUrl = new URL(
    `/api/public/${PUBLIC_API_VERSION}/index.json`,
    siteBaseUrl
  ).toString();
  const data = buildPublicApiIndexData(siteBaseUrl);

  return publicApiIndexResponseSchema.parse({
    apiVersion: PUBLIC_API_VERSION,
    generatedAt,
    canonicalUrl,
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: [NO_ADVICE_BOUNDARY],
    citation: buildPublicApiCitation({
      citationTitle: "University AI Policy Tracker public API index",
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        "University AI Policy Tracker public API index. University AI Policy Tracker. Version v1. " +
        canonicalUrl
    }),
    data
  });
}

export function buildPublicUniversityListResponse(
  summaries: PublicEntitySummary[],
  siteBaseUrl = DEFAULT_PUBLIC_SITE_BASE_URL,
  generatedAt = new Date().toISOString()
): PublicUniversityListResponse {
  const canonicalUrl = new URL("/universities", siteBaseUrl).toString();
  const publicJsonUrl = new URL(
    `/api/public/${PUBLIC_API_VERSION}/universities.json`,
    siteBaseUrl
  ).toString();

  return publicUniversityListResponseSchema.parse({
    apiVersion: PUBLIC_API_VERSION,
    generatedAt,
    canonicalUrl,
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: [NO_ADVICE_BOUNDARY],
    citation: buildPublicApiCitation({
      citationTitle: "University AI Policy Tracker universities dataset",
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        "University AI Policy Tracker universities dataset. University AI Policy Tracker. Version v1. " +
        canonicalUrl
    }),
    data: buildPublicUniversityListData(summaries)
  });
}

export function buildPublicEntitySummaryResponse(
  summary: PublicEntitySummary,
  siteBaseUrl = DEFAULT_PUBLIC_SITE_BASE_URL,
  generatedAt = new Date().toISOString()
): PublicEntitySummaryResponse {
  const publicJsonUrl =
    summary.apiUrl ??
    new URL(
      `/api/public/${PUBLIC_API_VERSION}/universities/${summary.entity.slug}.json`,
      siteBaseUrl
    ).toString();

  return publicEntitySummaryResponseSchema.parse({
    ...summary,
    apiVersion: PUBLIC_API_VERSION,
    generatedAt,
    canonicalUrl: summary.canonicalUrl,
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: summary.limitations,
    citation: buildPublicApiCitation({
      citationTitle: summary.citationTitle,
      canonicalUrl: summary.canonicalUrl,
      publicJsonUrl,
      suggestedCitation: summary.suggestedCitation
    }),
    data: summary
  });
}

export function buildPublicRecentChangesEnvelope(
  response: PublicRecentChangesResponse,
  siteBaseUrl = DEFAULT_PUBLIC_SITE_BASE_URL
): PublicRecentChangesEnvelope {
  const canonicalUrl = new URL("/changes", siteBaseUrl).toString();
  const publicJsonUrl = new URL(
    `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`,
    siteBaseUrl
  ).toString();

  return publicRecentChangesEnvelopeSchema.parse({
    ...response,
    apiVersion: PUBLIC_API_VERSION,
    canonicalUrl,
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    citation: buildPublicApiCitation({
      citationTitle: "University AI Policy Tracker recent changes",
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        "University AI Policy Tracker recent changes. University AI Policy Tracker. Version v1. " +
        canonicalUrl
    }),
    data: {
      changes: response.changes
    }
  });
}

export const publicContractExamples = {
  universities: buildSeedPublicEntitySummaries(),
  apiIndex: buildPublicApiIndexResponse(
    DEFAULT_PUBLIC_SITE_BASE_URL,
    "2026-05-04T00:00:00.000Z"
  ),
  universityList: buildPublicUniversityListResponse(
    buildSeedPublicEntitySummaries(),
    DEFAULT_PUBLIC_SITE_BASE_URL,
    "2026-05-04T00:00:00.000Z"
  ),
  universityResponses: buildSeedPublicEntitySummaries().map((summary) =>
    buildPublicEntitySummaryResponse(
      summary,
      DEFAULT_PUBLIC_SITE_BASE_URL,
      "2026-05-04T00:00:00.000Z"
    )
  ),
  recentChanges: publicRecentChangesResponseSchema.parse({
    schemaVersion: PUBLIC_API_VERSION,
    generatedAt: "2026-05-04T00:00:00.000Z",
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: [NO_ADVICE_BOUNDARY],
    changes: buildSeedPublicEntitySummaries().map((summary) => ({
      entitySlug: summary.entity.slug,
      entityName: summary.entity.name,
      canonicalUrl: summary.canonicalUrl,
      citationTitle: summary.citationTitle,
      lastCheckedAt: summary.lastCheckedAt,
      lastChangedAt: summary.lastChangedAt,
      reviewState: summary.reviewState,
      claimCount: summary.claims.length,
      claims: summary.claims
    }))
  }) satisfies PublicRecentChangesResponse,
  recentChangesEnvelope: buildPublicRecentChangesEnvelope(
    publicRecentChangesResponseSchema.parse({
      schemaVersion: PUBLIC_API_VERSION,
      generatedAt: "2026-05-04T00:00:00.000Z",
      license: TRACKER_METADATA_LICENSE,
      trackerMetadataLicense: TRACKER_METADATA_LICENSE,
      sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
      sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
      limitations: [NO_ADVICE_BOUNDARY],
      changes: buildSeedPublicEntitySummaries().map((summary) => ({
        entitySlug: summary.entity.slug,
        entityName: summary.entity.name,
        canonicalUrl: summary.canonicalUrl,
        citationTitle: summary.citationTitle,
        lastCheckedAt: summary.lastCheckedAt,
        lastChangedAt: summary.lastChangedAt,
        reviewState: summary.reviewState,
        claimCount: summary.claims.length,
        claims: summary.claims
      }))
    }),
    DEFAULT_PUBLIC_SITE_BASE_URL
  )
};

function buildSeedSourceAttribution(
  university: SeedUniversity,
  source: SeedPolicySource
): SourceAttribution {
  return {
    sourceUrl: source.url,
    citationTitle: source.title,
    publisher: university.name,
    retrievedAt: source.lastCheckedAt,
    snapshotHash: makeSeedSnapshotHash(`${university.slug}:${source.url}`),
    sourceType: "official_policy_page",
    official: true,
    sourceRights: OFFICIAL_SOURCE_RIGHTS_CAVEAT
  };
}

function normalizeClaimReviewState(value: string): ClaimReviewState {
  if (value === "machine_extracted") return "machine_candidate";

  const parsed = claimReviewStateSchema.safeParse(value);
  return parsed.success ? parsed.data : "needs_review";
}

function aggregateReviewState(states: ClaimReviewState[]): ClaimReviewState {
  if (!states.length) return "needs_review";
  if (states.includes("rejected")) return "needs_review";
  if (states.includes("needs_review")) return "needs_review";
  if (states.includes("machine_candidate")) return "machine_candidate";
  if (states.includes("agent_reviewed")) return "agent_reviewed";
  return "human_reviewed";
}

function latestIso(values: Array<string | undefined>): string | undefined {
  const dates = values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a));

  return dates[0];
}

function buildSuggestedCitation(
  universityName: string,
  canonicalUrl: string,
  lastCheckedAt: string | undefined
): string {
  const checkedText = lastCheckedAt
    ? `Last checked ${lastCheckedAt.slice(0, 10)}.`
    : "Last checked date pending.";

  return `${universityName} AI Policy Tracker record. University AI Policy Tracker. ${checkedText} ${canonicalUrl}`;
}

function makeSeedSnapshotHash(input: string): string {
  const hex = Array.from(input)
    .map((character) => character.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");

  return hex.padEnd(64, "0").slice(0, 64);
}
