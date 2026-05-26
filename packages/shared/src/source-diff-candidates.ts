import { z } from "zod";
import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  sourceTypeSchema
} from "./claims";

export const SOURCE_DIFF_CANDIDATE_SCHEMA_VERSION =
  "uapt-source-diff-candidates-v1";

export const sourceDiffClassSchema = z.enum([
  "content_policy_delta",
  "source_index_expansion",
  "metadata_or_chrome_delta",
  "http_or_access_noise",
  "source_unavailable",
  "source_removed_candidate",
  "source_replaced_candidate"
]);

export const sourceDiffReviewActionSchema = z.enum([
  "no_action",
  "write_no_change_note",
  "needs_openclaw_light_review",
  "needs_codex_review",
  "needs_source_repair",
  "candidate_deprecate_claims"
]);

export const sourceDiffHunkSchema = z.object({
  hunkId: z.string().min(1),
  oldExcerpt: z.string().max(1400).optional(),
  newExcerpt: z.string().max(1400).optional(),
  policySignalTerms: z.array(z.string().min(1)).default([]),
  summary: z.string().min(1)
});

export const sourceDiffCandidateSchema = z.object({
  schemaVersion: z
    .literal(SOURCE_DIFF_CANDIDATE_SCHEMA_VERSION)
    .default(SOURCE_DIFF_CANDIDATE_SCHEMA_VERSION),
  candidateId: z.string().min(1),
  currentReleaseId: z.string().min(1),
  previousReleaseId: z.string().min(1),
  entityName: z.string().min(1),
  entitySlug: z.string().min(1),
  sourceUrl: z.string().url(),
  finalUrl: z.string().url().optional(),
  sourceTitle: z.string().min(1).optional(),
  sourceType: sourceTypeSchema.optional(),
  sourceLastModified: z.string().datetime().optional(),
  trackerCheckedAt: z.string().datetime().optional(),
  oldPublicSnapshotHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  newPublicSnapshotHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  oldNormalizedTextHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  newNormalizedTextHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  diffClass: sourceDiffClassSchema,
  confidence: z.number().min(0).max(1),
  recommendedAction: sourceDiffReviewActionSchema,
  openClawConcurrencyPolicy: z.literal("single_source_no_concurrency").default(
    "single_source_no_concurrency"
  ),
  hunks: z.array(sourceDiffHunkSchema).default([]),
  limitations: z.array(z.string().min(1)).default([
    NO_ADVICE_BOUNDARY,
    "Source diff candidates are maintenance metadata. They are not public claim evidence until reviewed and promoted."
  ]),
  sourceRightsPolicy: z.string().min(1).default(OFFICIAL_SOURCE_RIGHTS_CAVEAT)
});

export const sourceDiffCandidateDocumentSchema = z.object({
  schemaVersion: z
    .literal(SOURCE_DIFF_CANDIDATE_SCHEMA_VERSION)
    .default(SOURCE_DIFF_CANDIDATE_SCHEMA_VERSION),
  apiVersion: z.literal(PUBLIC_API_VERSION).default(PUBLIC_API_VERSION),
  generatedAt: z.string().datetime(),
  previousReleaseId: z.string().min(1),
  currentReleaseId: z.string().min(1),
  license: z.literal(TRACKER_METADATA_LICENSE).default(TRACKER_METADATA_LICENSE),
  sourceRightsPolicy: z.string().min(1).default(OFFICIAL_SOURCE_RIGHTS_CAVEAT),
  boundary: z
    .string()
    .min(1)
    .default(
      "Private source diff candidates contain short policy-relevant excerpts only. They do not publish raw source text and do not by themselves change public claims."
    ),
  candidates: z.array(sourceDiffCandidateSchema),
  summary: z.record(z.string(), z.number().int().nonnegative())
});

export type SourceDiffClass = z.infer<typeof sourceDiffClassSchema>;
export type SourceDiffReviewAction = z.infer<
  typeof sourceDiffReviewActionSchema
>;
export type SourceDiffHunk = z.infer<typeof sourceDiffHunkSchema>;
export type SourceDiffCandidate = z.infer<typeof sourceDiffCandidateSchema>;
export type SourceDiffCandidateDocument = z.infer<
  typeof sourceDiffCandidateDocumentSchema
>;
