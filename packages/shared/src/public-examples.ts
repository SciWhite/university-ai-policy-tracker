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
import {
  buildPublicToolsResponse,
  deriveUniversityToolRecords,
  formatToolLabel,
  publicToolsResponseSchema,
  type PublicToolsResponse
} from "./tools";

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
            "contract placeholder, not a reviewed policy conclusion. " +
            buildSeedToolMentionSentence(source),
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
        "Entity search",
        `/api/public/${PUBLIC_API_VERSION}/search.json?q=mit`,
        "Search public university records by canonical name, alias, official source title, claim summary, source domain, or analysis dimension.",
        `/api/public/${PUBLIC_API_VERSION}/search.json?q={query}`
      ),
      endpoint(
        "Safe search index",
        `/api/public/${PUBLIC_API_VERSION}/search/index.json`,
        "Pagefind-ready public search index excluding raw snapshots, private files, unpromoted staging evidence, and non-authoritative spreadsheet rows."
      ),
      endpoint(
        "Entity resolution index",
        `/api/public/${PUBLIC_API_VERSION}/entities/index.json`,
        "Canonical public entities and aliases for recall. Aliases do not create policy facts."
      ),
      endpoint(
        "University record",
        `/api/public/${PUBLIC_API_VERSION}/universities/anu.json`,
        "One citation-ready university record with claims, evidence, sources, and review state.",
        `/api/public/${PUBLIC_API_VERSION}/universities/{slug}.json`
      ),
      endpoint(
        "University claims",
        `/api/public/${PUBLIC_API_VERSION}/claims/anu.json`,
        "One public university record's claim/evidence rows with source URL, source language, snapshot hash, confidence, and review state.",
        `/api/public/${PUBLIC_API_VERSION}/claims/{slug}.json`
      ),
      endpoint(
        "AI tools directory",
        `/api/public/${PUBLIC_API_VERSION}/tools.json`,
        "Derived university AI tool records with tool-level availability, review state, and evidence snippets. Tool records are discovery metadata, not official policy conclusions."
      ),
      endpoint(
        "Recent changes",
        `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`,
        "Recent public source checks and changed institution records."
      ),
      endpoint(
        "Changes index",
        `/api/public/${PUBLIC_API_VERSION}/changes/index.json`,
        "University-level change timeline index with filters, source-health summaries, and versioned public JSON links."
      ),
      endpoint(
        "Latest release diff",
        `/api/public/${PUBLIC_API_VERSION}/changes/latest.json`,
        "Latest release-to-release claim/evidence diff with added, removed, modified, and source snapshot change rows."
      ),
      endpoint(
        "Release diff",
        `/api/public/${PUBLIC_API_VERSION}/changes/public-release-20260523-002.json`,
        "One release-to-release claim/evidence diff artifact.",
        `/api/public/${PUBLIC_API_VERSION}/changes/{releaseId}.json`
      ),
      endpoint(
        "University release diff",
        `/api/public/${PUBLIC_API_VERSION}/changes/latest/emory-university.json`,
        "One university's latest release-to-release claim/evidence diff.",
        `/api/public/${PUBLIC_API_VERSION}/changes/latest/{slug}.json`
      ),
      endpoint(
        "Release snapshot claims",
        `/api/public/${PUBLIC_API_VERSION}/datasets/release-snapshots/public-release-20260523-002/claims.jsonl`,
        "Immutable claim/evidence snapshot for a public release. It excludes raw source page text.",
        `/api/public/${PUBLIC_API_VERSION}/datasets/release-snapshots/{releaseId}/claims.jsonl`
      ),
      endpoint(
        "Analysis API index",
        `/api/public/${PUBLIC_API_VERSION}/analysis/index.json`,
        "Manifest for deterministic policy analysis dimensions, endpoints, limitations, and version metadata."
      ),
      endpoint(
        "University analysis profile",
        `/api/public/${PUBLIC_API_VERSION}/analysis/universities/anu.json`,
        "One source-backed policy analysis profile with dimensions, evidence claim IDs, source URLs, confidence, review state, and coverage score.",
        `/api/public/${PUBLIC_API_VERSION}/analysis/universities/{slug}.json`
      ),
      endpoint(
        "Policy coverage scores",
        `/api/public/${PUBLIC_API_VERSION}/analysis/coverage-scores.json`,
        "Coverage score list for public analysis profiles. Scores measure breadth of source-backed public coverage, not policy quality."
      ),
      endpoint(
        "Analysis page quality",
        `/api/public/${PUBLIC_API_VERSION}/analysis/page-quality.json`,
        "Read-only page-quality gates, indexability status, analysis review workflow, and no-advice boundaries for public analysis pages."
      ),
      endpoint(
        "QS 2026 coverage",
        `/api/public/${PUBLIC_API_VERSION}/coverage/qs-2026.json`,
        "Collection coverage rows for QS 2026 targets with public, staging-only, missing, source-count, review-state, and next-action fields."
      ),
      endpoint(
        "Source health",
        `/api/public/${PUBLIC_API_VERSION}/source-health.json`,
        "Source and fetch health metadata for promoted public source snapshots, Firecrawl verification checks, and staging runs. Used for repair planning, not claim publication."
      ),
      endpoint(
        "Review queue",
        `/api/public/${PUBLIC_API_VERSION}/review/queue.json`,
        "Unpromoted staging run metadata with validation status, source breadth, detected slugs, and recommended next action."
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
      ),
      endpoint(
        "Monthly report chart data",
        `/api/public/${PUBLIC_API_VERSION}/reports/monthly/2026-05/chart-data.json`,
        "Chart-ready source-language, review-state, region coverage, city/campus coverage, and ranking coverage distributions for the May 2026 monthly baseline report."
      ),
      endpoint(
        "Reports index",
        `/api/public/${PUBLIC_API_VERSION}/reports/index.json`,
        "Machine-readable index of public reports, feeds, outreach links, report metrics, and data links."
      ),
      endpoint(
        "Reports outreach package",
        `/api/public/${PUBLIC_API_VERSION}/reports/outreach.json`,
        "Machine-readable media and newsletter copy with use boundaries for citation-safe public sharing."
      ),
      endpoint(
        "Widget index",
        `/api/public/${PUBLIC_API_VERSION}/widgets/index.json`,
        "Embeddable widget discovery payload with script URL, constraints, and example HTML."
      ),
      endpoint(
        "University status widget",
        `/api/public/${PUBLIC_API_VERSION}/widgets/university-status/anu.json`,
        "Compact embeddable university status payload with freshness, review state, source counts, and canonical links.",
        `/api/public/${PUBLIC_API_VERSION}/widgets/university-status/{slug}.json`
      ),
      endpoint(
        "Recent changes widget",
        `/api/public/${PUBLIC_API_VERSION}/widgets/recent-changes.json`,
        "Compact embeddable recent changes payload with review-state labels."
      ),
      endpoint(
        "Policy coverage widget",
        `/api/public/${PUBLIC_API_VERSION}/widgets/policy-coverage/anu.json`,
        "Compact source-backed policy coverage widget payload. Coverage is breadth, not policy quality.",
        `/api/public/${PUBLIC_API_VERSION}/widgets/policy-coverage/{slug}.json`
      ),
      endpoint(
        "Source freshness widget",
        `/api/public/${PUBLIC_API_VERSION}/widgets/source-freshness/anu.json`,
        "Compact source freshness widget payload with last checked date, source count, and public source-health counts.",
        `/api/public/${PUBLIC_API_VERSION}/widgets/source-freshness/{slug}.json`
      ),
      endpoint(
        "Review-state widget",
        `/api/public/${PUBLIC_API_VERSION}/widgets/review-state/anu.json`,
        "Compact review-state widget payload with confidence, reviewed claim count, and candidate claim count.",
        `/api/public/${PUBLIC_API_VERSION}/widgets/review-state/{slug}.json`
      ),
      endpoint(
        "MCP alpha manifest",
        `/api/public/${PUBLIC_API_VERSION}/mcp/manifest.json`,
        "Read-only MCP alpha design manifest with allowed tools, prohibited mutations, and agent query examples."
      ),
      endpoint(
        "MCP tool catalog",
        `/api/public/${PUBLIC_API_VERSION}/mcp/tool-catalog.json`,
        "Read-only MCP alpha tool catalog with input schemas, required output fields, and hard prohibited mutations."
      ),
      endpoint(
        "Rate-limit policy",
        `/api/public/${PUBLIC_API_VERSION}/rate-limit-policy.json`,
        "Machine-readable public fair-use, rate-limit, and crawler policy."
      ),
      endpoint(
        "Citation metadata",
        `/api/public/${PUBLIC_API_VERSION}/citation.json`,
        "Machine-readable citation templates, required fields, source rights caveat, and evidence reuse rules."
      ),
      endpoint(
        "Contribution index",
        `/api/public/${PUBLIC_API_VERSION}/contributions/index.json`,
        "Read-only contribution workflow metadata, GitHub issue template URLs, safeguards, and publication rules."
      ),
      endpoint(
        "Contribution review policy",
        `/api/public/${PUBLIC_API_VERSION}/contributions/review-policy.json`,
        "Read-only review queue definitions, moderation boundaries, and publication gates."
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
      ),
      trustPage(
        "Reports",
        "/reports",
        "Dataset reports, public feeds, chart data, and outreach assets."
      ),
      trustPage(
        "Policy analysis",
        "/analysis",
        "Deterministic source-backed policy analysis profiles, coverage scores, dimensions, and caveats."
      ),
      trustPage(
        "AI tools",
        "/tools",
        "Derived AI tool directory with source-backed evidence, review state, and policy-boundary caveats."
      ),
      trustPage(
        "Coverage",
        "/coverage",
        "Collection coverage dashboards for ranking targets, staging runs, source health, and review queue metadata."
      ),
      trustPage(
        "Source health",
        "/source-health",
        "Source snapshot, Firecrawl verification, and staging fetch status dashboard for crawl repair planning."
      ),
      trustPage(
        "Review queue",
        "/review/queue",
        "Unpromoted staging-run queue for validation, repair, and promotion planning."
      ),
      trustPage(
        "Outreach package",
        "/reports/outreach",
        "Citation-safe public copy for researchers, newsletters, and media."
      ),
      trustPage(
        "Widgets",
        "/widgets",
        "Embeddable read-only status and recent-change widgets."
      ),
      trustPage(
        "API reference",
        "/api-reference",
        "Developer-facing public API documentation, versioning, citation, and rate-limit guidance."
      ),
      trustPage(
        "MCP alpha",
        "/mcp",
        "Read-only agent access design and example retrieval queries."
      ),
      trustPage(
        "Contribute",
        "/contribute",
        "Public contribution intake paths for source URLs, corrections, course evidence, translation fixes, and dataset issues."
      ),
      trustPage(
        "Review workflow",
        "/review",
        "Contribution review queues, safeguards, moderation rules, and publication gates."
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
  toolsResponse: buildPublicToolsResponse(
    deriveUniversityToolRecords(buildSeedPublicEntitySummaries()),
    DEFAULT_PUBLIC_SITE_BASE_URL,
    "2026-05-04T00:00:00.000Z"
  ) satisfies PublicToolsResponse,
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

function buildSeedToolMentionSentence(source: SeedPolicySource): string {
  const tools = source.tools.map((tool) =>
    formatToolLabel(tool as Parameters<typeof formatToolLabel>[0])
  );

  return tools.length
    ? `Seed metadata names ${tools.join(", ")} without making a tool-level availability conclusion.`
    : "Seed metadata does not name a specific AI tool.";
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
