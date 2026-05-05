import { z } from "zod";
import {
  aiServiceStatusSchema,
  aiToolSchema,
  academicContextSchema,
  audienceSchema,
  dataSensitivitySchema,
  documentStatusSchema,
  governanceThemeSchema,
  policyAuthoritySchema,
  reviewStateSchema,
  serviceTreatmentSchema,
  sourceEvidenceSchema
} from "./schemas";

export const fetchModeSchema = z.enum([
  "http",
  "playwright",
  "opencli",
  "firecrawl"
]);

export const crawlRunStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "skipped"
]);

export const jsonMetadataSchema = z.record(z.string(), z.unknown());

export const crawlTargetSchema = z.object({
  url: z.string().url(),
  universitySlug: z.string().min(1).optional(),
  sourceTitle: z.string().min(1).optional(),
  fetchMode: fetchModeSchema.default("http"),
  expectedThemes: z.array(governanceThemeSchema).default([]),
  metadata: jsonMetadataSchema.optional()
});

export const crawlPlanSchema = z.object({
  planId: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1).default("local"),
  targets: z.array(crawlTargetSchema).min(1)
});

export const crawlArtifactSchema = z.object({
  target: crawlTargetSchema,
  requestedUrl: z.string().url(),
  finalUrl: z.string().url().optional(),
  statusCode: z.number().int().positive().optional(),
  ok: z.boolean(),
  fetchedAt: z.string().datetime(),
  headers: z.record(z.string(), z.string()).default({}),
  rawStorageKey: z.string().min(1).optional(),
  normalizedText: z.string().min(1).optional(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  failureReason: z.string().min(1).optional(),
  metadata: jsonMetadataSchema.optional()
});

export const crawlRunIngestPayloadSchema = z.object({
  universitySlug: z.string().min(1).optional(),
  sourceUrl: z.string().url().optional(),
  sourceTitle: z.string().min(1).optional(),
  requestedUrl: z.string().url(),
  finalUrl: z.string().url().optional(),
  status: crawlRunStatusSchema.default("succeeded"),
  fetchMode: fetchModeSchema.default("http"),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  httpStatus: z.number().int().positive().optional(),
  robotsAllowed: z.boolean().optional(),
  failureReason: z.string().min(1).optional(),
  metadata: jsonMetadataSchema.optional()
});

export const sourceSnapshotIngestPayloadSchema = z.object({
  crawlRunId: z.string().min(1).optional(),
  universitySlug: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceTitle: z.string().min(1).optional(),
  finalUrl: z.string().url().optional(),
  documentStatus: documentStatusSchema,
  policyAuthority: policyAuthoritySchema.optional(),
  fetchedAt: z.string().datetime(),
  httpStatus: z.number().int().positive().optional(),
  etag: z.string().min(1).optional(),
  lastModified: z.string().min(1).optional(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  normalizedText: z.string().min(1),
  rawStorageKey: z.string().min(1).optional(),
  markChanged: z.boolean().default(true),
  metadata: jsonMetadataSchema.optional()
});

export const extractionCandidateIngestPayloadSchema = z.object({
  crawlRunId: z.string().min(1).optional(),
  sourceSnapshotId: z.string().min(1),
  documentStatus: documentStatusSchema,
  policyAuthority: policyAuthoritySchema.optional(),
  aiServiceStatus: aiServiceStatusSchema,
  serviceTreatment: serviceTreatmentSchema,
  aiTools: z.array(aiToolSchema).default([]),
  themes: z.array(governanceThemeSchema).default([]),
  audiences: z.array(audienceSchema).default([]),
  academicContexts: z.array(academicContextSchema).default([]),
  dataSensitivities: z.array(dataSensitivitySchema).default([]),
  evidence: z.array(sourceEvidenceSchema).min(1),
  summary: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1),
  reviewState: reviewStateSchema.default("machine_extracted")
});

export type FetchMode = z.infer<typeof fetchModeSchema>;
export type CrawlRunStatus = z.infer<typeof crawlRunStatusSchema>;
export type CrawlTarget = z.infer<typeof crawlTargetSchema>;
export type CrawlPlan = z.infer<typeof crawlPlanSchema>;
export type CrawlArtifact = z.infer<typeof crawlArtifactSchema>;
export type CrawlRunIngestPayload = z.infer<typeof crawlRunIngestPayloadSchema>;
export type SourceSnapshotIngestPayload = z.infer<
  typeof sourceSnapshotIngestPayloadSchema
>;
export type ExtractionCandidateIngestPayload = z.infer<
  typeof extractionCandidateIngestPayloadSchema
>;
