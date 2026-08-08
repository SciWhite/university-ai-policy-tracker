import { z } from "zod";
import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  publicApiCitationSchema,
  trackerMetadataLicenseSchema
} from "./claims";
import { audiences, academicContexts } from "./taxonomy";

export const POLICY_SNAPSHOT_SCHEMA_VERSION = "uapt-policy-snapshot-v1";
export const POLICY_SNAPSHOT_INDEX_SCHEMA_VERSION =
  "uapt-policy-snapshot-index-v1";

export const policySnapshotOverallStatusSchema = z.enum([
  "strong",
  "stale",
  "needs_review"
]);

export const policySnapshotAudienceSchema = z.enum(audiences);
export const policySnapshotAcademicContextSchema = z.enum(academicContexts);

export const policySnapshotScopeSchema = z.enum([
  "university_wide",
  "unit_specific",
  "course_or_assessment",
  "research_or_thesis",
  "mixed"
]);

export const policySnapshotDimensionKeySchema = z.enum([
  "coursework",
  "exams",
  "disclosure",
  "privacy_data",
  "approved_tools",
  "research_publication"
]);

export const policySnapshotDimensionStatusSchema = z.enum([
  "allowed",
  "conditionally_allowed",
  "restricted",
  "blocked",
  "required",
  "recommended",
  "not_mentioned",
  "unclear",
  "insufficient_public_evidence"
]);

export const policySnapshotStatusReasonSchema = z.enum([
  "release_changed",
  "claim_changed",
  "source_hash_changed",
  "basis_fingerprint_mismatch",
  "basis_claim_missing",
  "basis_source_missing",
  "review_incomplete",
  "translation_needs_review",
  "index_mismatch",
  "schema_invalid"
]);

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const releaseIdSchema = z
  .string()
  .regex(/^public-release-[a-z0-9][a-z0-9-]*$/);
const localeSchema = z
  .string()
  .regex(/^[a-z]{2,3}(?:-[A-Z][a-z]{2,3})?$/);
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const policySnapshotSourceRefSchema = z
  .object({
    sourceUrl: z.string().url(),
    sourceSnapshotHash: sha256Schema
  })
  .strict();

export const policySnapshotBasisSchema = z
  .object({
    claimIds: z.array(z.string().min(1)).max(100),
    sources: z.array(policySnapshotSourceRefSchema).max(100)
  })
  .strict()
  .superRefine((basis, context) => {
    if (new Set(basis.claimIds).size !== basis.claimIds.length) {
      context.addIssue({
        code: "custom",
        message: "basis claimIds must be unique",
        path: ["claimIds"]
      });
    }

    const sourceUrls = basis.sources.map((source) => source.sourceUrl);
    if (new Set(sourceUrls).size !== sourceUrls.length) {
      context.addIssue({
        code: "custom",
        message: "basis sources must contain one current hash per source URL",
        path: ["sources"]
      });
    }
  });

export const policySnapshotActionsSchema = z
  .object({
    do: z.array(z.string().min(1).max(180)).max(3),
    dont: z.array(z.string().min(1).max(180)).max(3)
  })
  .strict();

export const policySnapshotDimensionSchema = z
  .object({
    key: policySnapshotDimensionKeySchema,
    status: policySnapshotDimensionStatusSchema,
    summary: z.string().min(1).max(280),
    actions: policySnapshotActionsSchema,
    basis: policySnapshotBasisSchema
  })
  .strict()
  .superRefine((dimension, context) => {
    const hasBasis =
      dimension.basis.claimIds.length > 0 || dimension.basis.sources.length > 0;

    if (dimension.status === "not_mentioned") {
      if (hasBasis) {
        context.addIssue({
          code: "custom",
          message: "not_mentioned dimensions must not include basis records",
          path: ["basis"]
        });
      }
      if (
        dimension.actions.do.length > 0 ||
        dimension.actions.dont.length > 0
      ) {
        context.addIssue({
          code: "custom",
          message: "not_mentioned dimensions must not give do/dont actions",
          path: ["actions"]
        });
      }
    } else if (!hasBasis) {
      context.addIssue({
        code: "custom",
        message: `${dimension.status} dimensions require claim and source basis`,
        path: ["basis"]
      });
    }
  });

export const policySnapshotAgentReviewSchema = z
  .object({
    agentId: z.string().min(1).max(120),
    model: z.string().min(1).max(160),
    decision: z.enum(["approve", "needs_review"]),
    reviewedAt: z.string().datetime(),
    notes: z.string().min(1).max(280).optional()
  })
  .strict();

export const policySnapshotReviewSchema = z
  .object({
    reviewState: z.enum(["dual_agent_reviewed", "needs_review"]),
    primary: policySnapshotAgentReviewSchema,
    secondary: policySnapshotAgentReviewSchema,
    agreement: z.enum(["agree", "disagree"]),
    reviewedAt: z.string().datetime()
  })
  .strict();

export const policySnapshotTranslationReviewSchema = z
  .object({
    status: z.enum(["reviewed", "needs_review"]),
    displayOnly: z.literal(true),
    sourceLocale: z.literal("en"),
    reviewer: z.string().min(1).max(120),
    reviewedAt: z.string().datetime(),
    notes: z.string().min(1).max(280).optional()
  })
  .strict();

export const policySnapshotLocalizedDimensionSchema = z
  .object({
    key: policySnapshotDimensionKeySchema,
    summary: z.string().min(1).max(280),
    actions: policySnapshotActionsSchema
  })
  .strict();

export const policySnapshotTranslationSchema = z
  .object({
    locale: localeSchema.refine((locale) => locale !== "en", {
      message: "English is canonical and cannot be a translation locale"
    }),
    summary: z.string().min(1).max(280),
    dimensions: z.array(policySnapshotLocalizedDimensionSchema).max(6),
    review: policySnapshotTranslationReviewSchema
  })
  .strict()
  .superRefine((translation, context) => {
    const keys = translation.dimensions.map((dimension) => dimension.key);
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: "custom",
        message: "translated dimensions must be unique",
        path: ["dimensions"]
      });
    }
  });

export const policySnapshotSchema = z
  .object({
    schemaVersion: z.literal(POLICY_SNAPSHOT_SCHEMA_VERSION),
    apiVersion: z.literal(PUBLIC_API_VERSION),
    entityType: z.literal("university"),
    universitySlug: slugSchema,
    universityName: z.string().min(1).max(180),
    canonicalUrl: z.string().url(),
    publicJsonUrl: z.string().url(),
    canonicalLocale: z.literal("en"),
    generatedAt: z.string().datetime(),
    overallStatus: policySnapshotOverallStatusSchema,
    statusReasons: z.array(policySnapshotStatusReasonSchema).max(10),
    summary: z.string().min(1).max(500),
    audiences: z.array(policySnapshotAudienceSchema).min(1).max(audiences.length),
    scope: policySnapshotScopeSchema,
    academicContexts: z
      .array(policySnapshotAcademicContextSchema)
      .min(1)
      .max(academicContexts.length),
    dimensions: z.array(policySnapshotDimensionSchema).length(6),
    basis: policySnapshotBasisSchema,
    releaseId: releaseIdSchema,
    basisFingerprint: sha256Schema,
    review: policySnapshotReviewSchema,
    translations: z.array(policySnapshotTranslationSchema).max(20),
    limitations: z.array(z.string().min(1).max(280)).min(1)
  })
  .strict()
  .superRefine((snapshot, context) => {
    const keys = snapshot.dimensions.map((dimension) => dimension.key);
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: "custom",
        message: "snapshot dimensions must be unique",
        path: ["dimensions"]
      });
    }

    for (const key of policySnapshotDimensionKeySchema.options) {
      if (!keys.includes(key)) {
        context.addIssue({
          code: "custom",
          message: `snapshot is missing dimension ${key}`,
          path: ["dimensions"]
        });
      }
    }

    const dimensionClaimIds = unique(
      snapshot.dimensions.flatMap((dimension) => dimension.basis.claimIds)
    );
    const dimensionSources = uniqueSources(
      snapshot.dimensions.flatMap((dimension) => dimension.basis.sources)
    );
    if (!sameStringSet(snapshot.basis.claimIds, dimensionClaimIds)) {
      context.addIssue({
        code: "custom",
        message: "top-level basis claimIds must equal dimension basis claimIds",
        path: ["basis", "claimIds"]
      });
    }
    if (!sameSourceSet(snapshot.basis.sources, dimensionSources)) {
      context.addIssue({
        code: "custom",
        message: "top-level basis sources must equal dimension basis sources",
        path: ["basis", "sources"]
      });
    }

    const translationLocales = snapshot.translations.map(
      (translation) => translation.locale
    );
    if (new Set(translationLocales).size !== translationLocales.length) {
      context.addIssue({
        code: "custom",
        message: "translation locales must be unique",
        path: ["translations"]
      });
    }

    if (
      new Set(snapshot.audiences).size !== snapshot.audiences.length ||
      new Set(snapshot.academicContexts).size !== snapshot.academicContexts.length
    ) {
      context.addIssue({
        code: "custom",
        message: "audiences and academicContexts must be unique",
        path: ["audiences"]
      });
    }

    if (snapshot.overallStatus === "strong") {
      if (snapshot.statusReasons.length > 0) {
        context.addIssue({
          code: "custom",
          message: "strong snapshots cannot carry statusReasons",
          path: ["statusReasons"]
        });
      }
      if (
        snapshot.review.reviewState !== "dual_agent_reviewed" ||
        snapshot.review.primary.decision !== "approve" ||
        snapshot.review.secondary.decision !== "approve" ||
        snapshot.review.agreement !== "agree"
      ) {
        context.addIssue({
          code: "custom",
          message: "strong snapshots require agreeing approval from two agents",
          path: ["review"]
        });
      }
      if (snapshot.basis.claimIds.length === 0) {
        context.addIssue({
          code: "custom",
          message: "strong snapshots require a non-empty claim basis",
          path: ["basis"]
        });
      }
      for (const translation of snapshot.translations) {
        if (translation.review.status !== "reviewed") {
          context.addIssue({
            code: "custom",
            message: `strong snapshots require reviewed translation prose for ${translation.locale}`,
            path: ["translations"]
          });
        }
      }
    } else if (snapshot.statusReasons.length === 0) {
      context.addIssue({
        code: "custom",
        message: `${snapshot.overallStatus} snapshots require statusReasons`,
        path: ["statusReasons"]
      });
    }

    if (!snapshot.limitations.includes(NO_ADVICE_BOUNDARY)) {
      context.addIssue({
        code: "custom",
        message: "snapshot limitations must include the no-advice boundary",
        path: ["limitations"]
      });
    }

    if (!snapshot.publicJsonUrl.includes(`/api/public/${PUBLIC_API_VERSION}/`)) {
      context.addIssue({
        code: "custom",
        message: "publicJsonUrl must be versioned under /api/public/v1/",
        path: ["publicJsonUrl"]
      });
    }
  });

export const policySnapshotIndexEntrySchema = z
  .object({
    universitySlug: slugSchema,
    universityName: z.string().min(1).max(180),
    file: z
      .string()
      .regex(/^universities\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/),
    publicJsonUrl: z.string().url(),
    overallStatus: policySnapshotOverallStatusSchema,
    releaseId: releaseIdSchema,
    generatedAt: z.string().datetime(),
    basisFingerprint: sha256Schema,
    locales: z.array(localeSchema).max(20)
  })
  .strict();

export const policySnapshotIndexSchema = z
  .object({
    schemaVersion: z.literal(POLICY_SNAPSHOT_INDEX_SCHEMA_VERSION),
    apiVersion: z.literal(PUBLIC_API_VERSION),
    snapshotSchemaVersion: z.literal(POLICY_SNAPSHOT_SCHEMA_VERSION),
    generatedAt: z.string().datetime(),
    releaseId: releaseIdSchema,
    entries: z.array(policySnapshotIndexEntrySchema),
    limitations: z.array(z.string().min(1).max(280)).min(1)
  })
  .strict()
  .superRefine((index, context) => {
    const slugs = index.entries.map((entry) => entry.universitySlug);
    if (new Set(slugs).size !== slugs.length) {
      context.addIssue({
        code: "custom",
        message: "snapshot index university slugs must be unique",
        path: ["entries"]
      });
    }
    for (const entry of index.entries) {
      if (entry.releaseId !== index.releaseId) {
        context.addIssue({
          code: "custom",
          message: `snapshot ${entry.universitySlug} does not match index releaseId`,
          path: ["entries"]
        });
      }
    }
    if (!index.limitations.includes(NO_ADVICE_BOUNDARY)) {
      context.addIssue({
        code: "custom",
        message: "snapshot index limitations must include the no-advice boundary",
        path: ["limitations"]
      });
    }
  });

const publicEnvelopeBaseSchema = z
  .object({
    apiVersion: z.literal(PUBLIC_API_VERSION),
    generatedAt: z.string().datetime(),
    canonicalUrl: z.string().url(),
    license: trackerMetadataLicenseSchema,
    trackerMetadataLicense: trackerMetadataLicenseSchema,
    sourcePolicy: z.string().min(1),
    sourceRightsPolicy: z.string().min(1),
    limitations: z.array(z.string().min(1)).min(1),
    citation: publicApiCitationSchema
  })
  .strict();

export const policySnapshotResponseSchema = publicEnvelopeBaseSchema
  .extend({ data: policySnapshotSchema })
  .strict();

export const policySnapshotIndexResponseSchema = publicEnvelopeBaseSchema
  .extend({ data: policySnapshotIndexSchema })
  .strict();

export const publicUniversityPolicySnapshotLinkSchema = z
  .object({
    publicJsonUrl: z.string().url(),
    overallStatus: policySnapshotOverallStatusSchema,
    releaseId: releaseIdSchema,
    basisFingerprint: sha256Schema
  })
  .strict();

export type PolicySnapshotOverallStatus = z.infer<
  typeof policySnapshotOverallStatusSchema
>;
export type PolicySnapshotAudience = z.infer<
  typeof policySnapshotAudienceSchema
>;
export type PolicySnapshotAcademicContext = z.infer<
  typeof policySnapshotAcademicContextSchema
>;
export type PolicySnapshotScope = z.infer<typeof policySnapshotScopeSchema>;
export type PolicySnapshotDimensionKey = z.infer<
  typeof policySnapshotDimensionKeySchema
>;
export type PolicySnapshotDimensionStatus = z.infer<
  typeof policySnapshotDimensionStatusSchema
>;
export type PolicySnapshotStatusReason = z.infer<
  typeof policySnapshotStatusReasonSchema
>;
export type PolicySnapshotSourceRef = z.infer<
  typeof policySnapshotSourceRefSchema
>;
export type PolicySnapshotBasis = z.infer<typeof policySnapshotBasisSchema>;
export type PolicySnapshotActions = z.infer<typeof policySnapshotActionsSchema>;
export type PolicySnapshotDimension = z.infer<
  typeof policySnapshotDimensionSchema
>;
export type PolicySnapshotAgentReview = z.infer<
  typeof policySnapshotAgentReviewSchema
>;
export type PolicySnapshotReview = z.infer<typeof policySnapshotReviewSchema>;
export type PolicySnapshotTranslationReview = z.infer<
  typeof policySnapshotTranslationReviewSchema
>;
export type PolicySnapshotTranslation = z.infer<
  typeof policySnapshotTranslationSchema
>;
export type PolicySnapshot = z.infer<typeof policySnapshotSchema>;
export type PolicySnapshotIndexEntry = z.infer<
  typeof policySnapshotIndexEntrySchema
>;
export type PolicySnapshotIndex = z.infer<typeof policySnapshotIndexSchema>;
export type PolicySnapshotResponse = z.infer<typeof policySnapshotResponseSchema>;
export type PolicySnapshotIndexResponse = z.infer<
  typeof policySnapshotIndexResponseSchema
>;
export type PublicUniversityPolicySnapshotLink = z.infer<
  typeof publicUniversityPolicySnapshotLinkSchema
>;

export interface PolicySnapshotFingerprintClaim {
  id?: string;
  claimType: string;
  claimText: string;
  claimValue?: string;
  reviewState: string;
  evidence: Array<{
    sourceUrl: string;
    sourceSnapshotHash: string;
  }>;
}

export const POLICY_SNAPSHOT_LICENSE = TRACKER_METADATA_LICENSE;
export const POLICY_SNAPSHOT_SOURCE_POLICY = OFFICIAL_SOURCE_RIGHTS_CAVEAT;

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function uniqueSources(sources: PolicySnapshotSourceRef[]): PolicySnapshotSourceRef[] {
  const byUrl = new Map<string, PolicySnapshotSourceRef>();
  for (const source of sources) byUrl.set(source.sourceUrl, source);
  return [...byUrl.values()].sort(compareSources);
}

function sameStringSet(left: string[], right: string[]): boolean {
  return JSON.stringify(unique(left)) === JSON.stringify(unique(right));
}

function sameSourceSet(
  left: PolicySnapshotSourceRef[],
  right: PolicySnapshotSourceRef[]
): boolean {
  return JSON.stringify(uniqueSources(left)) === JSON.stringify(uniqueSources(right));
}

function compareSources(
  left: PolicySnapshotSourceRef,
  right: PolicySnapshotSourceRef
): number {
  return (
    left.sourceUrl.localeCompare(right.sourceUrl) ||
    left.sourceSnapshotHash.localeCompare(right.sourceSnapshotHash)
  );
}
