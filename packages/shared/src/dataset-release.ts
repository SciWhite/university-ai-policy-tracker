import { z } from "zod";
import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  publicApiCitationSchema,
  trackerMetadataLicenseSchema
} from "./claims";

export const publicDatasetArtifactIdSchema = z.enum([
  "universities",
  "claims",
  "sources",
  "changes",
  "data_dictionary",
  "checksums"
]);

export const publicDatasetArtifactMediaTypeSchema = z.enum([
  "application/json",
  "application/jsonl",
  "text/markdown",
  "text/plain"
]);

export const publicDatasetArtifactSchema = z.object({
  id: publicDatasetArtifactIdSchema,
  label: z.string().min(1),
  description: z.string().min(1),
  path: z.string().regex(/^\/api\/public\/v1\/datasets\/.+/),
  url: z.string().url(),
  fileName: z.string().min(1),
  mediaType: publicDatasetArtifactMediaTypeSchema,
  byteLength: z.number().int().nonnegative(),
  rowCount: z.number().int().nonnegative().optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/)
});

export const publicDatasetReleaseCountsSchema = z.object({
  universities: z.number().int().nonnegative(),
  claims: z.number().int().nonnegative(),
  sources: z.number().int().nonnegative(),
  changes: z.number().int().nonnegative(),
  evidenceRecords: z.number().int().nonnegative(),
  sourceLanguages: z.record(z.string(), z.number().int().nonnegative()),
  reviewStates: z.record(z.string(), z.number().int().nonnegative())
});

export const publicDatasetReleaseManifestSchema = z.object({
  schemaVersion: z.literal("uapt-dataset-release-v1"),
  apiVersion: z.literal(PUBLIC_API_VERSION),
  releaseId: z.string().min(1),
  previousReleaseId: z.string().min(1).optional(),
  releasePeriod: z.string().regex(/^\d{4}-\d{2}$/),
  publishedAt: z.string().datetime(),
  generatedAt: z.string().datetime(),
  canonicalUrl: z.string().url(),
  license: trackerMetadataLicenseSchema.default(TRACKER_METADATA_LICENSE),
  trackerMetadataLicense: trackerMetadataLicenseSchema.default(
    TRACKER_METADATA_LICENSE
  ),
  sourcePolicy: z.string().min(1).default(OFFICIAL_SOURCE_RIGHTS_CAVEAT),
  sourceRightsPolicy: z.string().min(1).default(OFFICIAL_SOURCE_RIGHTS_CAVEAT),
  limitations: z.array(z.string().min(1)).default([NO_ADVICE_BOUNDARY]),
  citation: publicApiCitationSchema,
  counts: publicDatasetReleaseCountsSchema,
  diffArtifactUrl: z.string().url().optional(),
  releaseSnapshotUrl: z.string().url().optional(),
  changeCounts: z
    .object({
      entitiesChanged: z.number().int().nonnegative(),
      added: z.number().int().nonnegative(),
      removed: z.number().int().nonnegative(),
      modified: z.number().int().nonnegative(),
      unchanged: z.number().int().nonnegative()
    })
    .optional(),
  artifacts: z.array(publicDatasetArtifactSchema).min(1)
});

export type PublicDatasetArtifactId = z.infer<
  typeof publicDatasetArtifactIdSchema
>;
export type PublicDatasetArtifact = z.infer<typeof publicDatasetArtifactSchema>;
export type PublicDatasetReleaseCounts = z.infer<
  typeof publicDatasetReleaseCountsSchema
>;
export type PublicDatasetReleaseManifest = z.infer<
  typeof publicDatasetReleaseManifestSchema
>;
