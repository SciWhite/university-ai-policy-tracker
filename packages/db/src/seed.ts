import { createHash } from "node:crypto";
import {
  DEFAULT_PUBLIC_SITE_BASE_URL,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  seedUniversities,
  type SeedPolicySource,
  type SeedUniversity
} from "@uapt/shared";
import {
  AiServiceStatus as PrismaAiServiceStatus,
  CanonicalEntityType as PrismaCanonicalEntityType,
  ClaimReviewState as PrismaClaimReviewState,
  DocumentStatus as PrismaDocumentStatus,
  ReviewState as PrismaReviewState,
  ServiceTreatment as PrismaServiceTreatment,
  type PrismaClient
} from "@prisma/client";
import { getPrismaClient } from "./client.js";
import { toDbEnum } from "./enums.js";
import type { Prisma } from "./prisma-client.js";

type SeedClient = any;

export interface SeedResult {
  universities: number;
  sources: number;
  claims: number;
}

export async function seedInitialCatalog(
  client: PrismaClient = getPrismaClient()
): Promise<SeedResult> {
  return client.$transaction(async (transaction) => {
    const result: SeedResult = {
      universities: 0,
      sources: 0,
      claims: 0
    };

    for (const universitySeed of seedUniversities) {
      await seedUniversity(transaction, universitySeed);
      result.universities += 1;
      result.sources += universitySeed.sources.length;
      result.claims += universitySeed.sources.length;
    }

    return result;
  });
}

async function seedUniversity(
  client: SeedClient,
  universitySeed: SeedUniversity
): Promise<void> {
  const university = await client.university.upsert({
    where: { slug: universitySeed.slug },
    update: {
      name: universitySeed.name,
      country: universitySeed.country,
      region: universitySeed.region,
      website: universitySeed.website,
      summary: universitySeed.summary
    },
    create: {
      slug: universitySeed.slug,
      name: universitySeed.name,
      country: universitySeed.country,
      region: universitySeed.region,
      website: universitySeed.website,
      summary: universitySeed.summary
    }
  });
  const canonicalEntity = await client.canonicalEntity.upsert({
    where: {
      type_slug: {
        type: PrismaCanonicalEntityType.UNIVERSITY,
        slug: universitySeed.slug
      }
    },
    update: {
      name: universitySeed.name,
      canonicalUrl: buildCanonicalUniversityUrl(universitySeed.slug),
      summary: universitySeed.summary
    },
    create: {
      type: PrismaCanonicalEntityType.UNIVERSITY,
      slug: universitySeed.slug,
      name: universitySeed.name,
      canonicalUrl: buildCanonicalUniversityUrl(universitySeed.slug),
      summary: universitySeed.summary
    }
  });

  for (const sourceSeed of universitySeed.sources) {
    await seedPolicySource(
      client,
      university.id,
      canonicalEntity.id,
      universitySeed,
      sourceSeed
    );
  }
}

async function seedPolicySource(
  client: SeedClient,
  universityId: string,
  canonicalEntityId: string,
  universitySeed: SeedUniversity,
  sourceSeed: SeedPolicySource
): Promise<void> {
  const checkedAt = sourceSeed.lastCheckedAt
    ? new Date(sourceSeed.lastCheckedAt)
    : new Date();
  const changedAt = sourceSeed.lastChangedAt
    ? new Date(sourceSeed.lastChangedAt)
    : checkedAt;

  const policySource = await client.policySource.upsert({
    where: {
      universityId_url: {
        universityId,
        url: sourceSeed.url
      }
    },
    update: {
      title: sourceSeed.title,
      documentStatus: toDbEnum(PrismaDocumentStatus, sourceSeed.documentStatus),
      lastCheckedAt: checkedAt,
      lastChangedAt: changedAt
    },
    create: {
      universityId,
      url: sourceSeed.url,
      title: sourceSeed.title,
      documentStatus: toDbEnum(PrismaDocumentStatus, sourceSeed.documentStatus),
      lastCheckedAt: checkedAt,
      lastChangedAt: changedAt
    }
  });

  const normalizedText = [
    sourceSeed.title,
    `Document status: ${sourceSeed.documentStatus}`,
    `Service treatment: ${sourceSeed.serviceTreatment}`,
    `Themes: ${sourceSeed.themes.join(", ")}`,
    `Tools: ${sourceSeed.tools.join(", ")}`
  ].join("\n");
  const contentHash = sha256(normalizedText);

  const snapshot = await client.sourceSnapshot.upsert({
    where: {
      policySourceId_contentHash: {
        policySourceId: policySource.id,
        contentHash
      }
    },
    update: {
      normalizedText,
      fetchedAt: checkedAt,
      metadata: { seed: true }
    },
    create: {
      policySourceId: policySource.id,
      contentHash,
      normalizedText,
      fetchedAt: checkedAt,
      httpStatus: 200,
      metadata: { seed: true }
    }
  });

  const candidate = await client.extractionCandidate.upsert({
    where: {
      policySourceId_sourceSnapshotId: {
        policySourceId: policySource.id,
        sourceSnapshotId: snapshot.id
      }
    },
    update: {
      documentStatus: toDbEnum(PrismaDocumentStatus, sourceSeed.documentStatus),
      aiServiceStatus: deriveAiServiceStatus(sourceSeed),
      serviceTreatment: toDbEnum(
        PrismaServiceTreatment,
        sourceSeed.serviceTreatment
      ),
      aiTools: sourceSeed.tools,
      themes: sourceSeed.themes,
      evidence: [{ url: sourceSeed.url, title: sourceSeed.title }],
      confidence: 0.25,
      reviewState: toDbEnum(PrismaReviewState, sourceSeed.reviewState)
    },
    create: {
      universityId,
      policySourceId: policySource.id,
      sourceSnapshotId: snapshot.id,
      documentStatus: toDbEnum(PrismaDocumentStatus, sourceSeed.documentStatus),
      aiServiceStatus: deriveAiServiceStatus(sourceSeed),
      serviceTreatment: toDbEnum(
        PrismaServiceTreatment,
        sourceSeed.serviceTreatment
      ),
      aiTools: sourceSeed.tools,
      themes: sourceSeed.themes,
      audiences: [],
      academicContexts: [],
      dataSensitivities: [],
      evidence: [{ url: sourceSeed.url, title: sourceSeed.title }],
      summary: "Seed extraction candidate pending review.",
      confidence: 0.25,
      reviewState: toDbEnum(PrismaReviewState, sourceSeed.reviewState)
    }
  });

  await client.policyVersion.upsert({
    where: {
      policySourceId_versionNumber: {
        policySourceId: policySource.id,
        versionNumber: 1
      }
    },
    update: {
      sourceSnapshotId: snapshot.id,
      extractionCandidateId: candidate.id,
      documentStatus: toDbEnum(PrismaDocumentStatus, sourceSeed.documentStatus),
      aiServiceStatus: deriveAiServiceStatus(sourceSeed),
      serviceTreatment: toDbEnum(
        PrismaServiceTreatment,
        sourceSeed.serviceTreatment
      ),
      aiTools: sourceSeed.tools,
      themes: sourceSeed.themes,
      summary: "Seed policy version pending source review."
    },
    create: {
      universityId,
      policySourceId: policySource.id,
      sourceSnapshotId: snapshot.id,
      extractionCandidateId: candidate.id,
      versionNumber: 1,
      documentStatus: toDbEnum(PrismaDocumentStatus, sourceSeed.documentStatus),
      aiServiceStatus: deriveAiServiceStatus(sourceSeed),
      serviceTreatment: toDbEnum(
        PrismaServiceTreatment,
        sourceSeed.serviceTreatment
      ),
      aiTools: sourceSeed.tools,
      themes: sourceSeed.themes,
      summary: "Seed policy version pending source review."
    }
  });

  const sourceAttribution = await client.sourceAttribution.upsert({
    where: {
      sourceUrl_snapshotHash: {
        sourceUrl: sourceSeed.url,
        snapshotHash: snapshot.contentHash
      }
    },
    update: {
      policySourceId: policySource.id,
      sourceSnapshotId: snapshot.id,
      citationTitle: sourceSeed.title,
      publisher: universitySeed.name,
      retrievedAt: checkedAt,
      sourceRights: OFFICIAL_SOURCE_RIGHTS_CAVEAT
    },
    create: {
      policySourceId: policySource.id,
      sourceSnapshotId: snapshot.id,
      sourceUrl: sourceSeed.url,
      finalUrl: policySource.finalUrl,
      citationTitle: sourceSeed.title,
      publisher: universitySeed.name,
      retrievedAt: checkedAt,
      snapshotHash: snapshot.contentHash,
      sourceRights: OFFICIAL_SOURCE_RIGHTS_CAVEAT
    }
  });
  const policyClaim = await client.policyClaim.upsert({
    where: {
      dedupeKey: `seed:claim:${canonicalEntityId}:${policySource.id}`
    },
    update: {
      claimText: buildSeedClaimText(universitySeed, sourceSeed),
      confidence: 0.25,
      reviewState: toClaimReviewState(sourceSeed.reviewState),
      lastCheckedAt: checkedAt,
      lastChangedAt: changedAt
    },
    create: {
      canonicalEntityId,
      claimType: "source_status",
      claimText: buildSeedClaimText(universitySeed, sourceSeed),
      confidence: 0.25,
      reviewState: toClaimReviewState(sourceSeed.reviewState),
      lastCheckedAt: checkedAt,
      lastChangedAt: changedAt,
      dedupeKey: `seed:claim:${canonicalEntityId}:${policySource.id}`
    }
  });

  await client.claimEvidence.upsert({
    where: {
      dedupeKey: `seed:evidence:${policyClaim.id}:${snapshot.contentHash}`
    },
    update: {
      sourceAttributionId: sourceAttribution.id,
      policySourceId: policySource.id,
      sourceSnapshotId: snapshot.id,
      sourceUrl: sourceSeed.url,
      sourceSnapshotHash: snapshot.contentHash,
      evidenceSnippet: buildSeedEvidenceSnippet(sourceSeed),
      retrievedAt: checkedAt
    },
    create: {
      policyClaimId: policyClaim.id,
      sourceAttributionId: sourceAttribution.id,
      policySourceId: policySource.id,
      sourceSnapshotId: snapshot.id,
      sourceUrl: sourceSeed.url,
      sourceSnapshotHash: snapshot.contentHash,
      evidenceSnippet: buildSeedEvidenceSnippet(sourceSeed),
      retrievedAt: checkedAt,
      dedupeKey: `seed:evidence:${policyClaim.id}:${snapshot.contentHash}`
    }
  });
}

function deriveAiServiceStatus(
  sourceSeed: SeedPolicySource
): typeof PrismaAiServiceStatus[keyof typeof PrismaAiServiceStatus] {
  if (sourceSeed.tools.includes("institutional_ai_service")) {
    return PrismaAiServiceStatus.INSTITUTIONALLY_LICENSED_OR_PROCURED;
  }

  return PrismaAiServiceStatus.THIRD_PARTY_SERVICE;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function toClaimReviewState(reviewState: string) {
  if (reviewState === "agent_reviewed") return PrismaClaimReviewState.AGENT_REVIEWED;
  if (reviewState === "human_reviewed") return PrismaClaimReviewState.HUMAN_REVIEWED;
  if (reviewState === "needs_review") return PrismaClaimReviewState.NEEDS_REVIEW;

  return PrismaClaimReviewState.MACHINE_CANDIDATE;
}

function buildSeedClaimText(
  universitySeed: SeedUniversity,
  sourceSeed: SeedPolicySource
): string {
  return (
    `${universitySeed.name} has a cataloged AI policy source titled ` +
    `"${sourceSeed.title}". Policy conclusions remain pending review unless ` +
    "a claim is marked agent_reviewed or human_reviewed."
  );
}

function buildSeedEvidenceSnippet(sourceSeed: SeedPolicySource): string {
  return [
    `Seed catalog record: ${sourceSeed.title}.`,
    `Document status: ${sourceSeed.documentStatus}.`,
    `Service treatment: ${sourceSeed.serviceTreatment}.`
  ].join(" ");
}

function buildCanonicalUniversityUrl(slug: string): string {
  return new URL(
    `/universities/${slug}`,
    process.env.WEB_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      DEFAULT_PUBLIC_SITE_BASE_URL
  ).toString();
}
