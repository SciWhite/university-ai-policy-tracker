import type {
  CrawlRunIngestPayload,
  ExtractionCandidateIngestPayload,
  SourceSnapshotIngestPayload
} from "@uapt/shared";
import {
  AiServiceStatus as PrismaAiServiceStatus,
  CrawlStatus as PrismaCrawlStatus,
  DocumentStatus as PrismaDocumentStatus,
  FetchMode as PrismaFetchMode,
  PolicyAuthority as PrismaPolicyAuthority,
  ReviewState as PrismaReviewState,
  ServiceTreatment as PrismaServiceTreatment,
  type PrismaClient
} from "@prisma/client";
import { getPrismaClient } from "./client.js";
import { toDbEnum } from "./enums.js";
import type { Prisma } from "./prisma-client.js";

export interface IngestedCrawlRunResult {
  id: string;
  status: string;
  requestedUrl: string;
}

export interface IngestedSourceSnapshotResult {
  id: string;
  policySourceId: string;
  contentHash: string;
}

export interface IngestedExtractionCandidateResult {
  id: string;
  policySourceId: string;
  sourceSnapshotId: string;
  reviewState: string;
}

export async function ingestCrawlRun(
  payload: CrawlRunIngestPayload,
  client: PrismaClient = getPrismaClient()
): Promise<IngestedCrawlRunResult> {
  const university = payload.universitySlug
    ? await client.university.findUnique({
        where: { slug: payload.universitySlug }
      })
    : null;
  const policySource =
    university && payload.sourceUrl
      ? await client.policySource.findUnique({
          where: {
            universityId_url: {
              universityId: university.id,
              url: payload.sourceUrl
            }
          }
        })
      : null;

  const crawlRun = await client.crawlRun.create({
    data: {
      universityId: university?.id,
      policySourceId: policySource?.id,
      status: toDbEnum(PrismaCrawlStatus, payload.status),
      fetchMode: toDbEnum(PrismaFetchMode, payload.fetchMode),
      requestedUrl: payload.requestedUrl,
      finalUrl: payload.finalUrl,
      httpStatus: payload.httpStatus,
      robotsAllowed: payload.robotsAllowed,
      failureReason: payload.failureReason,
      startedAt: payload.startedAt ? new Date(payload.startedAt) : undefined,
      finishedAt: payload.finishedAt ? new Date(payload.finishedAt) : undefined,
      metadata: toJson(payload.metadata)
    }
  });

  return {
    id: crawlRun.id,
    status: crawlRun.status,
    requestedUrl: crawlRun.requestedUrl
  };
}

export async function ingestSourceSnapshot(
  payload: SourceSnapshotIngestPayload,
  client: PrismaClient = getPrismaClient()
): Promise<IngestedSourceSnapshotResult> {
  const university = await client.university.findUnique({
    where: { slug: payload.universitySlug }
  });

  if (!university) {
    throw new Error(`Unknown university slug: ${payload.universitySlug}`);
  }

  const fetchedAt = new Date(payload.fetchedAt);
  const policySource = await client.policySource.upsert({
    where: {
      universityId_url: {
        universityId: university.id,
        url: payload.sourceUrl
      }
    },
    update: {
      finalUrl: payload.finalUrl,
      title: payload.sourceTitle,
      documentStatus: toDbEnum(PrismaDocumentStatus, payload.documentStatus),
      policyAuthority: payload.policyAuthority
        ? toDbEnum(PrismaPolicyAuthority, payload.policyAuthority)
        : undefined,
      lastCheckedAt: fetchedAt,
      lastChangedAt: payload.markChanged ? fetchedAt : undefined
    },
    create: {
      universityId: university.id,
      url: payload.sourceUrl,
      finalUrl: payload.finalUrl,
      title: payload.sourceTitle,
      documentStatus: toDbEnum(PrismaDocumentStatus, payload.documentStatus),
      policyAuthority: payload.policyAuthority
        ? toDbEnum(PrismaPolicyAuthority, payload.policyAuthority)
        : undefined,
      lastCheckedAt: fetchedAt,
      lastChangedAt: payload.markChanged ? fetchedAt : undefined
    }
  });

  const snapshot = await client.sourceSnapshot.upsert({
    where: {
      policySourceId_contentHash: {
        policySourceId: policySource.id,
        contentHash: payload.contentHash
      }
    },
    update: {
      crawlRunId: payload.crawlRunId,
      normalizedText: payload.normalizedText,
      rawStorageKey: payload.rawStorageKey,
      httpStatus: payload.httpStatus,
      etag: payload.etag,
      lastModified: payload.lastModified,
      fetchedAt,
      metadata: toJson(payload.metadata)
    },
    create: {
      policySourceId: policySource.id,
      crawlRunId: payload.crawlRunId,
      contentHash: payload.contentHash,
      normalizedText: payload.normalizedText,
      rawStorageKey: payload.rawStorageKey,
      httpStatus: payload.httpStatus,
      etag: payload.etag,
      lastModified: payload.lastModified,
      fetchedAt,
      metadata: toJson(payload.metadata)
    }
  });

  return {
    id: snapshot.id,
    policySourceId: policySource.id,
    contentHash: snapshot.contentHash
  };
}

export async function ingestExtractionCandidate(
  payload: ExtractionCandidateIngestPayload,
  client: PrismaClient = getPrismaClient()
): Promise<IngestedExtractionCandidateResult> {
  const snapshot = await client.sourceSnapshot.findUnique({
    where: { id: payload.sourceSnapshotId },
    include: { policySource: true }
  });

  if (!snapshot) {
    throw new Error(`Unknown source snapshot id: ${payload.sourceSnapshotId}`);
  }

  const candidate = await client.extractionCandidate.upsert({
    where: {
      policySourceId_sourceSnapshotId: {
        policySourceId: snapshot.policySourceId,
        sourceSnapshotId: snapshot.id
      }
    },
    update: {
      crawlRunId: payload.crawlRunId,
      documentStatus: toDbEnum(PrismaDocumentStatus, payload.documentStatus),
      policyAuthority: payload.policyAuthority
        ? toDbEnum(PrismaPolicyAuthority, payload.policyAuthority)
        : undefined,
      aiServiceStatus: toDbEnum(
        PrismaAiServiceStatus,
        payload.aiServiceStatus
      ),
      serviceTreatment: toDbEnum(
        PrismaServiceTreatment,
        payload.serviceTreatment
      ),
      aiTools: payload.aiTools,
      themes: payload.themes,
      audiences: payload.audiences,
      academicContexts: payload.academicContexts,
      dataSensitivities: payload.dataSensitivities,
      evidence: payload.evidence,
      summary: payload.summary,
      confidence: payload.confidence,
      reviewState: toDbEnum(PrismaReviewState, payload.reviewState)
    },
    create: {
      universityId: snapshot.policySource.universityId,
      policySourceId: snapshot.policySourceId,
      sourceSnapshotId: snapshot.id,
      crawlRunId: payload.crawlRunId,
      documentStatus: toDbEnum(PrismaDocumentStatus, payload.documentStatus),
      policyAuthority: payload.policyAuthority
        ? toDbEnum(PrismaPolicyAuthority, payload.policyAuthority)
        : undefined,
      aiServiceStatus: toDbEnum(
        PrismaAiServiceStatus,
        payload.aiServiceStatus
      ),
      serviceTreatment: toDbEnum(
        PrismaServiceTreatment,
        payload.serviceTreatment
      ),
      aiTools: payload.aiTools,
      themes: payload.themes,
      audiences: payload.audiences,
      academicContexts: payload.academicContexts,
      dataSensitivities: payload.dataSensitivities,
      evidence: payload.evidence,
      summary: payload.summary,
      confidence: payload.confidence,
      reviewState: toDbEnum(PrismaReviewState, payload.reviewState)
    }
  });

  return {
    id: candidate.id,
    policySourceId: candidate.policySourceId,
    sourceSnapshotId: candidate.sourceSnapshotId,
    reviewState: candidate.reviewState
  };
}

function toJson(
  value: Record<string, unknown> | undefined
): Prisma.InputJsonValue | undefined {
  return value as Prisma.InputJsonValue | undefined;
}
