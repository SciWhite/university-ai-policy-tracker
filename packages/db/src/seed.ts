import { createHash } from "node:crypto";
import {
  seedUniversities,
  type SeedPolicySource,
  type SeedUniversity
} from "@uapt/shared";
import {
  AiServiceStatus as PrismaAiServiceStatus,
  DocumentStatus as PrismaDocumentStatus,
  ReviewState as PrismaReviewState,
  ServiceTreatment as PrismaServiceTreatment,
  type Prisma,
  type PrismaClient
} from "@prisma/client";
import { getPrismaClient } from "./client.js";

type SeedClient = PrismaClient | Prisma.TransactionClient;

export interface SeedResult {
  universities: number;
  sources: number;
}

export async function seedInitialCatalog(
  client: PrismaClient = getPrismaClient()
): Promise<SeedResult> {
  return client.$transaction(async (transaction) => {
    const result: SeedResult = {
      universities: 0,
      sources: 0
    };

    for (const universitySeed of seedUniversities) {
      await seedUniversity(transaction, universitySeed);
      result.universities += 1;
      result.sources += universitySeed.sources.length;
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

  for (const sourceSeed of universitySeed.sources) {
    await seedPolicySource(client, university.id, sourceSeed);
  }
}

async function seedPolicySource(
  client: SeedClient,
  universityId: string,
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

function toDbEnum<TEnum extends Record<string, string>>(
  enumValues: TEnum,
  value: string
): TEnum[keyof TEnum] {
  const key = value.toUpperCase();

  if (!(key in enumValues)) {
    throw new Error(`Unsupported enum value: ${value}`);
  }

  return enumValues[key as keyof TEnum];
}
