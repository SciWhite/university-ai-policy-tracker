import {
  DEFAULT_PUBLIC_SITE_BASE_URL,
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  claimReviewStateSchema,
  publicEntitySummarySchema,
  publicRecentChangesResponseSchema,
  type ClaimReviewState,
  type PublicEntitySummary,
  type PublicRecentChangesResponse,
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

export const publicContractExamples = {
  universities: buildSeedPublicEntitySummaries(),
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
  }) satisfies PublicRecentChangesResponse
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
