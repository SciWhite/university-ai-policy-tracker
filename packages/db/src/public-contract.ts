import {
  DEFAULT_PUBLIC_SITE_BASE_URL,
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  buildPublicApiIndexResponse,
  buildPublicEntitySummaryResponse,
  buildPublicRecentChangesEnvelope,
  buildPublicUniversityListResponse,
  claimReviewStateSchema,
  policyClaimSchema,
  publicEntitySummarySchema,
  publicRecentChangesResponseSchema,
  type ClaimEvidence,
  type ClaimReviewState,
  type PolicyClaim,
  type PolicyClaimType,
  type PublicApiIndexResponse,
  type PublicEntitySummaryResponse,
  type PublicEntitySummary,
  type PublicRecentChangesEnvelope,
  type PublicRecentChangesResponse,
  type PublicUniversityListResponse,
  type SourceAttribution
} from "@uapt/shared";
import {
  CanonicalEntityType as PrismaCanonicalEntityType,
  type PrismaClient
} from "@prisma/client";
import { getPrismaClient } from "./client.js";
import type { Prisma } from "./prisma-client.js";

const publicUniversityInclude = {
  policySources: {
    where: { active: true },
    orderBy: [{ title: "asc" }, { url: "asc" }],
    include: {
      extractionCandidates: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      policyVersions: {
        orderBy: { versionNumber: "desc" },
        take: 1
      },
      snapshots: {
        orderBy: { fetchedAt: "desc" },
        take: 1
      }
    }
  }
} as any;

const policyClaimInclude = {
  evidence: {
    orderBy: { createdAt: "asc" },
    include: {
      policySource: true,
      sourceAttribution: true,
      sourceSnapshot: true
    }
  }
} as any;

type PublicUniversityRecord = any;

type StoredPolicyClaim = any;

export async function getPublicUniversitySummaryBySlug(
  slug: string,
  client: PrismaClient = getPrismaClient()
): Promise<PublicEntitySummary | null> {
  const university = (await client.university.findUnique({
    where: { slug },
    include: publicUniversityInclude
  })) as any;

  if (!university) return null;

  const canonicalEntity = (await client.canonicalEntity.findUnique({
    where: {
      type_slug: {
        type: PrismaCanonicalEntityType.UNIVERSITY,
        slug
      }
    },
    include: {
      policyClaims: {
        orderBy: [{ lastChangedAt: "desc" }, { createdAt: "desc" }],
        include: policyClaimInclude
      }
    }
  })) as any;

  const canonicalUrl =
    canonicalEntity?.canonicalUrl ?? buildCanonicalUniversityUrl(university.slug);
  const storedClaims = ((canonicalEntity?.policyClaims ?? []) as any[])
    .map((claim: any) => mapStoredClaim(university.slug, claim))
    .filter(Boolean) as PolicyClaim[];
  const claims = storedClaims.length
    ? storedClaims
    : buildFallbackClaims(university, canonicalUrl);
  const officialSources = mergeOfficialSources([
    ...university.policySources
      .map((source: any) => buildSourceAttribution(university, source))
      .filter((source: any): source is SourceAttribution => Boolean(source)),
    ...claims.flatMap((claim: any) =>
      claim.evidence.map((evidence: any) => evidence.attribution)
    )
  ]);
  const lastCheckedAt = latestIso([
    ...university.policySources.map((source: any) =>
      source.lastCheckedAt?.toISOString()
    ),
    ...claims.map((claim: any) => claim.lastCheckedAt)
  ]);
  const lastChangedAt = latestIso([
    ...university.policySources.map((source: any) =>
      source.lastChangedAt?.toISOString()
    ),
    ...claims.map((claim: any) => claim.lastChangedAt)
  ]);

  return publicEntitySummarySchema.parse({
    schemaVersion: PUBLIC_API_VERSION,
    citationTitle: `${university.name} AI Policy Tracker record`,
    canonicalUrl,
    publicPageUrl: canonicalUrl,
    apiUrl: buildPublicUniversityApiUrl(university.slug),
    entityType: "university",
    entitySlug: university.slug,
    entity: {
      id: canonicalEntity?.id,
      type: "university",
      slug: university.slug,
      name: university.name,
      canonicalUrl,
      aliases: canonicalEntity?.aliases ?? [],
      summary: canonicalEntity?.summary ?? university.summary ?? undefined
    },
    summary:
      canonicalEntity?.summary ??
      university.summary ??
      "Source-backed university AI policy status is pending review.",
    lastCheckedAt,
    lastChangedAt,
    confidence: claims.length
      ? Math.max(...claims.map((claim) => claim.confidence))
      : undefined,
    reviewState: aggregateReviewState(claims.map((claim) => claim.reviewState)),
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: [NO_ADVICE_BOUNDARY],
    officialSources,
    claims,
    suggestedCitation: buildSuggestedCitation(university.name, canonicalUrl, lastCheckedAt)
  });
}

export async function getPublicUniversitySummaryResponseBySlug(
  slug: string,
  client: PrismaClient = getPrismaClient()
): Promise<PublicEntitySummaryResponse | null> {
  const summary = await getPublicUniversitySummaryBySlug(slug, client);

  return summary
    ? buildPublicEntitySummaryResponse(summary, getSiteBaseUrl())
    : null;
}

export async function listPublicUniversitySummaries(
  limit = 100,
  client: PrismaClient = getPrismaClient()
): Promise<PublicEntitySummary[]> {
  const universities = await client.university.findMany({
    orderBy: { name: "asc" },
    take: limit,
    select: { slug: true }
  });

  return (
    await Promise.all(
      universities.map((university: any) =>
        getPublicUniversitySummaryBySlug(university.slug, client)
      )
    )
  ).filter((summary): summary is PublicEntitySummary => Boolean(summary));
}

export async function listPublicUniversitiesResponse(
  limit = 100,
  client: PrismaClient = getPrismaClient()
): Promise<PublicUniversityListResponse> {
  const summaries = await listPublicUniversitySummaries(limit, client);

  return buildPublicUniversityListResponse(summaries, getSiteBaseUrl());
}

export function getPublicApiIndexResponse(): PublicApiIndexResponse {
  return buildPublicApiIndexResponse(getSiteBaseUrl());
}

export async function listPublicRecentChanges(
  limit = 25,
  client: PrismaClient = getPrismaClient()
): Promise<PublicRecentChangesResponse> {
  const changedSources = (await client.policySource.findMany({
    where: { active: true },
    orderBy: [{ lastChangedAt: "desc" }, { lastCheckedAt: "desc" }],
    take: limit * 2,
    include: {
      university: true
    }
  })) as any[];
  const slugs = Array.from(
    new Set(changedSources.map((source: any) => source.university.slug))
  ).slice(0, limit);
  const summaries = (
    await Promise.all(
      slugs.map((slug: any) => getPublicUniversitySummaryBySlug(slug, client))
    )
  ).filter((summary): summary is PublicEntitySummary => Boolean(summary));

  return publicRecentChangesResponseSchema.parse({
    schemaVersion: PUBLIC_API_VERSION,
    generatedAt: new Date().toISOString(),
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: [NO_ADVICE_BOUNDARY],
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

export async function listPublicRecentChangesEnvelope(
  limit = 25,
  client: PrismaClient = getPrismaClient()
): Promise<PublicRecentChangesEnvelope> {
  const response = await listPublicRecentChanges(limit, client);

  return buildPublicRecentChangesEnvelope(response, getSiteBaseUrl());
}

function mapStoredClaim(
  entitySlug: string,
  claim: StoredPolicyClaim
): PolicyClaim | null {
  if (claim.reviewState === "REJECTED") return null;

  const evidence = claim.evidence
    .map((item: any) => mapStoredEvidence(item))
    .filter((item: any): item is ClaimEvidence => Boolean(item));

  if (!evidence.length) return null;

  const parsed = policyClaimSchema.safeParse({
    id: claim.id,
    entitySlug,
    entityType: "university",
    claimType: normalizeClaimType(claim.claimType),
    claimText: claim.claimText,
    claimValue: claim.claimValue ?? undefined,
    confidence: claim.confidence,
    reviewState: fromDbClaimReviewState(claim.reviewState),
    lastCheckedAt: claim.lastCheckedAt?.toISOString(),
    lastChangedAt: claim.lastChangedAt?.toISOString(),
    evidence
  });

  return parsed.success ? parsed.data : null;
}

function mapStoredEvidence(
  evidence: StoredPolicyClaim["evidence"][number]
): ClaimEvidence | null {
  const snapshotHash =
    evidence.sourceSnapshotHash || evidence.sourceSnapshot?.contentHash;

  if (!snapshotHash || !isSnapshotHash(snapshotHash)) return null;

  const sourceUrl =
    evidence.sourceUrl ||
    evidence.sourceAttribution?.sourceUrl ||
    evidence.policySource?.url;

  if (!sourceUrl) return null;

  const attribution: SourceAttribution = {
    id: evidence.sourceAttribution?.id,
    sourceUrl,
    finalUrl:
      evidence.sourceAttribution?.finalUrl ??
      evidence.policySource?.finalUrl ??
      undefined,
    citationTitle:
      evidence.sourceAttribution?.citationTitle ??
      evidence.policySource?.title ??
      sourceUrl,
    publisher: evidence.sourceAttribution?.publisher ?? undefined,
    retrievedAt:
      evidence.sourceAttribution?.retrievedAt?.toISOString() ??
      evidence.retrievedAt?.toISOString() ??
      evidence.sourceSnapshot?.fetchedAt.toISOString(),
    snapshotHash,
    sourceType:
      normalizeSourceType(evidence.sourceAttribution?.sourceType) ??
      "official_policy_page",
    official: evidence.sourceAttribution?.official ?? true,
    sourceRights:
      evidence.sourceAttribution?.sourceRights ?? OFFICIAL_SOURCE_RIGHTS_CAVEAT
  };

  return {
    id: evidence.id,
    sourceUrl,
    sourceSnapshotHash: snapshotHash,
    evidenceSnippet: clampSnippet(evidence.evidenceSnippet),
    snippetLocation: evidence.snippetLocation ?? undefined,
    retrievedAt:
      evidence.retrievedAt?.toISOString() ??
      evidence.sourceSnapshot?.fetchedAt.toISOString(),
    attribution
  };
}

function buildFallbackClaims(
  university: PublicUniversityRecord,
  canonicalUrl: string
): PolicyClaim[] {
  return university.policySources.flatMap((source: any) => {
    const snapshot = source.snapshots[0];
    if (!snapshot || !isSnapshotHash(snapshot.contentHash)) return [];

    const attribution = buildSourceAttribution(university, source);
    if (!attribution) return [];

    const latestCandidate = source.extractionCandidates[0];
    const latestVersion = source.policyVersions[0];
    const claim = policyClaimSchema.safeParse({
      entitySlug: university.slug,
      entityType: "university",
      claimType: "source_status",
      claimText:
        `${university.name} has a cataloged AI policy source titled ` +
        `"${source.title ?? source.url}". This record does not publish a ` +
        "policy conclusion until claim review advances.",
      confidence: latestCandidate?.confidence ?? 0.25,
      reviewState: fromExtractionReviewState(latestCandidate?.reviewState),
      lastCheckedAt: source.lastCheckedAt?.toISOString() ?? snapshot.fetchedAt.toISOString(),
      lastChangedAt: source.lastChangedAt?.toISOString(),
      evidence: [
        {
          sourceUrl: source.url,
          sourceSnapshotHash: snapshot.contentHash,
          evidenceSnippet: clampSnippet(
            latestVersion?.summary ??
              latestCandidate?.summary ??
              snapshot.normalizedText
          ),
          retrievedAt: snapshot.fetchedAt.toISOString(),
          attribution
        }
      ]
    });

    if (!claim.success) return [];

    return [
      {
        ...claim.data,
        evidence: claim.data.evidence.map((evidence: any) => ({
          ...evidence,
          attribution: {
            ...evidence.attribution,
            sourceUrl: evidence.attribution.sourceUrl || canonicalUrl
          }
        }))
      }
    ];
  });
}

function buildSourceAttribution(
  university: PublicUniversityRecord,
  source: PublicUniversityRecord["policySources"][number]
): SourceAttribution | null {
  const snapshot = source.snapshots[0];
  if (!snapshot || !isSnapshotHash(snapshot.contentHash)) return null;

  return {
    sourceUrl: source.url,
    finalUrl: source.finalUrl ?? undefined,
    citationTitle: source.title ?? source.url,
    publisher: university.name,
    retrievedAt: snapshot.fetchedAt.toISOString(),
    snapshotHash: snapshot.contentHash,
    sourceType: "official_policy_page",
    official: true,
    sourceRights: OFFICIAL_SOURCE_RIGHTS_CAVEAT
  };
}

function buildCanonicalUniversityUrl(slug: string): string {
  return new URL(`/universities/${slug}`, getSiteBaseUrl()).toString();
}

function buildPublicUniversityApiUrl(slug: string): string {
  return new URL(
    `/api/public/${PUBLIC_API_VERSION}/universities/${slug}.json`,
    getApiBaseUrl()
  ).toString();
}

function getSiteBaseUrl(): string {
  return (
    process.env.WEB_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    DEFAULT_PUBLIC_SITE_BASE_URL
  );
}

function getApiBaseUrl(): string {
  return process.env.API_PUBLIC_BASE_URL || getSiteBaseUrl();
}

function fromDbClaimReviewState(value: string): ClaimReviewState {
  const parsed = claimReviewStateSchema.safeParse(value.toLowerCase());
  return parsed.success ? parsed.data : "needs_review";
}

function fromExtractionReviewState(value: string | undefined): ClaimReviewState {
  if (!value) return "needs_review";
  if (value === "AGENT_REVIEWED") return "agent_reviewed";
  if (value === "HUMAN_REVIEWED") return "human_reviewed";
  if (value === "NEEDS_REVIEW") return "needs_review";
  return "machine_candidate";
}

function aggregateReviewState(states: ClaimReviewState[]): ClaimReviewState {
  if (!states.length) return "needs_review";
  if (states.includes("needs_review")) return "needs_review";
  if (states.includes("machine_candidate")) return "machine_candidate";
  if (states.includes("agent_reviewed")) return "agent_reviewed";
  return "human_reviewed";
}

function normalizeClaimType(value: string): PolicyClaimType {
  const known = [
    "ai_tool_treatment",
    "academic_integrity",
    "privacy",
    "teaching",
    "research",
    "security_review",
    "procurement",
    "source_status",
    "other"
  ];

  return known.includes(value) ? (value as PolicyClaimType) : "other";
}

function normalizeSourceType(value: string | undefined): SourceAttribution["sourceType"] | undefined {
  const known = [
    "official_policy_page",
    "official_guidance",
    "official_pdf",
    "archived_official_source",
    "other"
  ] as const;

  return known.find((sourceType) => sourceType === value);
}

function mergeOfficialSources(sources: SourceAttribution[]): SourceAttribution[] {
  const byKey = new Map<string, SourceAttribution>();

  for (const source of sources) {
    byKey.set(`${source.sourceUrl}:${source.snapshotHash}`, source);
  }

  return Array.from(byKey.values());
}

function latestIso(values: Array<string | undefined>): string | undefined {
  const dates = values
    .filter((value: string | undefined): value is string => Boolean(value))
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

function clampSnippet(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 700) return normalized;
  return `${normalized.slice(0, 697).trimEnd()}...`;
}

function isSnapshotHash(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}
