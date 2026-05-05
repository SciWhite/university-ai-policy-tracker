import { z } from "zod";
import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  canonicalEntityTypeSchema,
  claimReviewStateSchema,
  policyClaimTypeSchema
} from "./claims";

export const OPENCLAW_ARTIFACT_SCHEMA_VERSION = "openclaw-artifact-v1";

export const artifactHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const sourceLanguageSchema = z
  .string()
  .min(2)
  .max(16)
  .regex(/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/);
export const openClawArtifactSchemaVersionSchema = z.literal(
  OPENCLAW_ARTIFACT_SCHEMA_VERSION
);

const fetchModeSchema = z.enum(["http", "playwright", "opencli", "firecrawl"]);
const artifactBaseSchema = z.object({
  schemaVersion: openClawArtifactSchemaVersionSchema.default(
    OPENCLAW_ARTIFACT_SCHEMA_VERSION
  ),
  runId: z.string().min(1)
});

export const stagedCitationSchema = z.object({
  citationTitle: z.string().min(1),
  sourceUrl: z.string().url(),
  publicJsonUrl: z
    .string()
    .url()
    .refine(
      (value) => new URL(value).pathname.startsWith(`/api/public/${PUBLIC_API_VERSION}/`),
      `publicJsonUrl must use /api/public/${PUBLIC_API_VERSION}/`
    )
    .optional(),
  canonicalUrl: z.string().url().optional(),
  publisher: z.string().min(1).optional(),
  retrievedAt: z.string().datetime().optional(),
  snapshotHash: artifactHashSchema.optional(),
  sourceRights: z.string().min(1).default(OFFICIAL_SOURCE_RIGHTS_CAVEAT)
});

export const stagedCrawlTargetSchema = z.object({
  entityType: canonicalEntityTypeSchema,
  entitySlug: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceTitle: z.string().min(1).optional(),
  sourceLanguage: sourceLanguageSchema,
  allowedFetchModes: z.array(fetchModeSchema).min(1).default(["http"]),
  expectedThemes: z.array(z.string().min(1)).default([]),
  maxUrls: z.number().int().positive().optional(),
  robotsPolicy: z.enum(["respect", "skip_if_disallowed"]).default("respect")
});

export const stagedCrawlPlanSchema = artifactBaseSchema.extend({
  artifactType: z.literal("crawl_plan"),
  planId: z.string().min(1),
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1),
  targets: z.array(stagedCrawlTargetSchema).min(1),
  stopConditions: z.array(z.string().min(1)).default([])
});

export const stagedSourceSnapshotSchema = artifactBaseSchema.extend({
  artifactType: z.literal("source_snapshot"),
  sourceSnapshotId: z.string().min(1),
  sourceUrl: z.string().url(),
  finalUrl: z.string().url().optional(),
  sourceTitle: z.string().min(1).optional(),
  sourceLanguage: sourceLanguageSchema,
  contentHash: artifactHashSchema,
  fetchedAt: z.string().datetime(),
  httpStatus: z.number().int().positive().optional(),
  robotsAllowed: z.boolean(),
  normalizedTextStorageKey: z.string().min(1).optional(),
  rawArtifactPaths: z.array(z.string().min(1)).default([])
});

export const stagedClaimCandidateSchema = artifactBaseSchema.extend({
  artifactType: z.literal("claim_candidate"),
  claimId: z.string().min(1),
  entityType: canonicalEntityTypeSchema,
  entitySlug: z.string().min(1),
  claimType: policyClaimTypeSchema,
  claimText: z.string().min(1),
  normalizedValue: z.string().min(1).optional(),
  sourceLanguage: sourceLanguageSchema,
  confidence: z.number().min(0).max(1),
  reviewState: claimReviewStateSchema,
  evidenceIds: z.array(z.string().min(1)).min(1),
  citation: stagedCitationSchema,
  publishAsCanonical: z.boolean().default(false),
  isCanonical: z.boolean().default(false)
});

export const stagedEvidenceCandidateSchema = artifactBaseSchema.extend({
  artifactType: z.literal("evidence_candidate"),
  evidenceId: z.string().min(1),
  claimId: z.string().min(1),
  sourceSnapshotId: z.string().min(1),
  policySourceId: z.string().min(1).optional(),
  sourceUrl: z.string().url(),
  finalUrl: z.string().url().optional(),
  sourceTitle: z.string().min(1),
  sourceLanguage: sourceLanguageSchema,
  snapshotHash: artifactHashSchema,
  evidenceSnippetOriginal: z.string().min(1).max(700),
  evidenceSnippetDisplay: z.string().min(1).max(700).optional(),
  evidenceLocator: z.string().min(1).optional(),
  evidenceType: z
    .enum(["official_source", "archived_official_source", "pdf", "unclear"])
    .default("official_source"),
  relevance: z.number().min(0).max(1),
  rightsNote: z.string().min(1).default(OFFICIAL_SOURCE_RIGHTS_CAVEAT),
  citation: stagedCitationSchema
});

export const stagedReviewDecisionSchema = artifactBaseSchema.extend({
  artifactType: z.literal("review_decision"),
  decisionId: z.string().min(1),
  claimId: z.string().min(1),
  decision: z.enum(["approve", "reject", "needs_changes"]),
  reviewState: claimReviewStateSchema,
  reviewerType: z.enum(["openclaw_agent", "human", "local_reviewer"]),
  reviewer: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
  decidedAt: z.string().datetime()
});

export const stagedReportDraftSchema = artifactBaseSchema.extend({
  artifactType: z.literal("report_draft"),
  reportId: z.string().min(1),
  title: z.string().min(1),
  generatedAt: z.string().datetime(),
  draftPath: z.string().regex(/^content\/reports\/.+\.mdx$/),
  summary: z.string().min(1),
  referencedClaimIds: z.array(z.string().min(1)).default([]),
  publicJsonLinks: z
    .array(
      z
        .string()
        .url()
        .refine(
          (value) =>
            new URL(value).pathname.startsWith(`/api/public/${PUBLIC_API_VERSION}/`),
          `publicJsonLinks must use /api/public/${PUBLIC_API_VERSION}/`
        )
    )
    .default([]),
  limitations: z.array(z.string().min(1)).default([NO_ADVICE_BOUNDARY]),
  trackerMetadataLicense: z.literal(TRACKER_METADATA_LICENSE).default(TRACKER_METADATA_LICENSE),
  sourceRightsPolicy: z.string().min(1).default(OFFICIAL_SOURCE_RIGHTS_CAVEAT),
  rawArtifactPaths: z.array(z.string().min(1)).default([])
});

export const openClawStagedArtifactSchema = z.discriminatedUnion("artifactType", [
  stagedCrawlPlanSchema,
  stagedSourceSnapshotSchema,
  stagedClaimCandidateSchema,
  stagedEvidenceCandidateSchema,
  stagedReviewDecisionSchema,
  stagedReportDraftSchema
]);

export const openClawArtifactBundleSchema = z.object({
  schemaVersion: openClawArtifactSchemaVersionSchema.default(
    OPENCLAW_ARTIFACT_SCHEMA_VERSION
  ),
  runId: z.string().min(1),
  artifacts: z.array(openClawStagedArtifactSchema).min(1)
});

export type StagedCrawlPlan = z.infer<typeof stagedCrawlPlanSchema>;
export type StagedSourceSnapshot = z.infer<typeof stagedSourceSnapshotSchema>;
export type StagedClaimCandidate = z.infer<typeof stagedClaimCandidateSchema>;
export type StagedEvidenceCandidate = z.infer<typeof stagedEvidenceCandidateSchema>;
export type StagedReviewDecision = z.infer<typeof stagedReviewDecisionSchema>;
export type StagedReportDraft = z.infer<typeof stagedReportDraftSchema>;
export type OpenClawStagedArtifact = z.infer<typeof openClawStagedArtifactSchema>;
export type OpenClawArtifactBundle = z.infer<typeof openClawArtifactBundleSchema>;
