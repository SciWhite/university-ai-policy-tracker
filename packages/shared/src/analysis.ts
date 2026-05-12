import { z } from "zod";
import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  canonicalEntityTypeSchema,
  publicApiCitationSchema,
  trackerMetadataLicenseSchema
} from "./claims";

export const POLICY_ANALYSIS_SCHEMA_VERSION = "uapt-policy-analysis-v1";

export const analysisReviewStateSchema = z.enum([
  "machine_candidate",
  "agent_reviewed",
  "human_reviewed",
  "institution_verified",
  "needs_review",
  "rejected"
]);

export const analysisDimensionStatusSchema = z.enum([
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

export const policyAnalysisDimensionKeySchema = z.enum([
  "policy_presence",
  "ai_disclosure",
  "coursework",
  "exams",
  "privacy_data_entry",
  "academic_integrity",
  "approved_tools",
  "named_ai_services",
  "teaching_guidance",
  "research_guidance",
  "security_procurement"
]);

export const policyCoverageScoreLabelSchema = z.enum([
  "minimal_public_coverage",
  "partial_public_coverage",
  "moderate_public_coverage",
  "broad_public_coverage"
]);

export const analysisSourceBasisSchema = z.object({
  claimId: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceLanguage: z.string().min(2).max(16),
  evidenceSnippet: z.string().min(1).max(700),
  sourceSnapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  reviewState: analysisReviewStateSchema
});

export const policyAnalysisDimensionSchema = z
  .object({
    key: policyAnalysisDimensionKeySchema,
    label: z.string().min(1),
    status: analysisDimensionStatusSchema,
    normalizedValue: z.string().min(1).optional(),
    summary: z.string().min(1),
    explanation: z.string().min(1),
    evidenceClaimIds: z.array(z.string().min(1)).default([]),
    evidenceSourceUrls: z.array(z.string().url()).default([]),
    sourceLanguages: z.array(z.string().min(2).max(16)).default([]),
    reviewState: analysisReviewStateSchema,
    confidence: z.number().min(0).max(1),
    evidenceCount: z.number().int().nonnegative(),
    sourceCount: z.number().int().nonnegative(),
    notMentionedReason: z.string().min(1).optional(),
    basis: z.array(analysisSourceBasisSchema).default([])
  })
  .superRefine((dimension, context) => {
    const hasEvidence = dimension.evidenceClaimIds.length > 0;
    const evidenceRequiredStatuses = new Set([
      "allowed",
      "conditionally_allowed",
      "restricted",
      "blocked",
      "required",
      "recommended",
      "unclear",
      "insufficient_public_evidence"
    ]);

    if (evidenceRequiredStatuses.has(dimension.status) && !hasEvidence) {
      context.addIssue({
        code: "custom",
        message: `${dimension.status} requires at least one evidenceClaimId`,
        path: ["evidenceClaimIds"]
      });
    }

    if (dimension.status === "not_mentioned") {
      if (hasEvidence || dimension.evidenceSourceUrls.length > 0) {
        context.addIssue({
          code: "custom",
          message: "not_mentioned dimensions must not include evidence claim IDs or source URLs",
          path: ["status"]
        });
      }
      if (!dimension.notMentionedReason) {
        context.addIssue({
          code: "custom",
          message: "not_mentioned dimensions require notMentionedReason",
          path: ["notMentionedReason"]
        });
      }
    }

    if (dimension.status !== "not_mentioned" && dimension.notMentionedReason) {
      context.addIssue({
        code: "custom",
        message: "notMentionedReason is only allowed for not_mentioned dimensions",
        path: ["notMentionedReason"]
      });
    }

    if (dimension.evidenceCount !== dimension.evidenceClaimIds.length) {
      context.addIssue({
        code: "custom",
        message: "evidenceCount must equal evidenceClaimIds.length",
        path: ["evidenceCount"]
      });
    }

    if (
      dimension.sourceCount !==
      new Set(dimension.evidenceSourceUrls).size
    ) {
      context.addIssue({
        code: "custom",
        message: "sourceCount must equal the number of unique evidenceSourceUrls",
        path: ["sourceCount"]
      });
    }

    for (const basis of dimension.basis) {
      if (!dimension.evidenceClaimIds.includes(basis.claimId)) {
        context.addIssue({
          code: "custom",
          message: `basis claimId ${basis.claimId} is not listed in evidenceClaimIds`,
          path: ["basis"]
        });
      }
      if (!dimension.evidenceSourceUrls.includes(basis.sourceUrl)) {
        context.addIssue({
          code: "custom",
          message: `basis sourceUrl ${basis.sourceUrl} is not listed in evidenceSourceUrls`,
          path: ["basis"]
        });
      }
      if (!dimension.sourceLanguages.includes(basis.sourceLanguage)) {
        context.addIssue({
          code: "custom",
          message: `basis sourceLanguage ${basis.sourceLanguage} is not listed in sourceLanguages`,
          path: ["basis"]
        });
      }
    }
  });

export const policyCoverageScoreComponentSchema = z.object({
  key: policyAnalysisDimensionKeySchema,
  label: z.string().min(1),
  points: z.number().min(0).max(100),
  maxPoints: z.number().positive().max(100),
  status: analysisDimensionStatusSchema,
  evidenceClaimIds: z.array(z.string().min(1)).default([]),
  reviewState: analysisReviewStateSchema
});

export const policyCoverageScoreSchema = z
  .object({
    score: z.number().min(0).max(100),
    maxScore: z.literal(100).default(100),
    label: policyCoverageScoreLabelSchema,
    components: z.array(policyCoverageScoreComponentSchema).min(1),
    reviewState: analysisReviewStateSchema,
    limitations: z.array(z.string().min(1)).default([NO_ADVICE_BOUNDARY])
  })
  .superRefine((score, context) => {
    const componentTotal = sumNumbers(
      score.components.map((component) => component.points)
    );
    const componentMax = sumNumbers(
      score.components.map((component) => component.maxPoints)
    );

    if (componentMax !== score.maxScore) {
      context.addIssue({
        code: "custom",
        message: "coverage score component maxPoints must sum to maxScore",
        path: ["components"]
      });
    }

    if (componentTotal !== score.score) {
      context.addIssue({
        code: "custom",
        message: "coverage score component points must sum to score",
        path: ["score"]
      });
    }

    for (const component of score.components) {
      if (component.points > component.maxPoints) {
        context.addIssue({
          code: "custom",
          message: `${component.key} points cannot exceed maxPoints`,
          path: ["components"]
        });
      }
    }
  });

export const policyAnalysisProfileSchema = z
  .object({
    schemaVersion: z
      .literal(POLICY_ANALYSIS_SCHEMA_VERSION)
      .default(POLICY_ANALYSIS_SCHEMA_VERSION),
    apiVersion: z.literal(PUBLIC_API_VERSION),
    entityType: canonicalEntityTypeSchema.extract(["university", "course"]),
    entitySlug: z.string().min(1),
    entityName: z.string().min(1),
    canonicalUrl: z.string().url(),
    publicJsonUrl: z.string().url(),
    generatedAt: z.string().datetime(),
    basedOnClaimIds: z.array(z.string().min(1)).default([]),
    basedOnSourceUrls: z.array(z.string().url()).default([]),
    sourceLanguages: z.array(z.string().min(2).max(16)).default([]),
    reviewState: analysisReviewStateSchema,
    confidence: z.number().min(0).max(1),
    coverageScore: policyCoverageScoreSchema,
    dimensions: z.array(policyAnalysisDimensionSchema).min(1),
    limitations: z.array(z.string().min(1)).default([NO_ADVICE_BOUNDARY]),
    suggestedCitation: z.string().min(1)
  })
  .superRefine((profile, context) => {
    if (!profile.publicJsonUrl.includes(`/api/public/${PUBLIC_API_VERSION}/`)) {
      context.addIssue({
        code: "custom",
        message: "publicJsonUrl must be versioned under /api/public/v1/",
        path: ["publicJsonUrl"]
      });
    }

    const dimensionKeys = new Set<string>();
    for (const dimension of profile.dimensions) {
      if (dimensionKeys.has(dimension.key)) {
        context.addIssue({
          code: "custom",
          message: `duplicate analysis dimension key: ${dimension.key}`,
          path: ["dimensions"]
        });
      }
      dimensionKeys.add(dimension.key);

      for (const claimId of dimension.evidenceClaimIds) {
        if (!profile.basedOnClaimIds.includes(claimId)) {
          context.addIssue({
            code: "custom",
            message: `dimension ${dimension.key} references claimId not listed in basedOnClaimIds: ${claimId}`,
            path: ["dimensions"]
          });
        }
      }

      for (const sourceUrl of dimension.evidenceSourceUrls) {
        if (!profile.basedOnSourceUrls.includes(sourceUrl)) {
          context.addIssue({
            code: "custom",
            message: `dimension ${dimension.key} references sourceUrl not listed in basedOnSourceUrls: ${sourceUrl}`,
            path: ["dimensions"]
          });
        }
      }

      for (const language of dimension.sourceLanguages) {
        if (!profile.sourceLanguages.includes(language)) {
          context.addIssue({
            code: "custom",
            message: `dimension ${dimension.key} references sourceLanguage not listed in profile sourceLanguages: ${language}`,
            path: ["dimensions"]
          });
        }
      }
    }

    const componentKeys = new Set(
      profile.coverageScore.components.map((component) => component.key)
    );
    for (const key of componentKeys) {
      if (!dimensionKeys.has(key)) {
        context.addIssue({
          code: "custom",
          message: `coverage component ${key} does not have a matching analysis dimension`,
          path: ["coverageScore", "components"]
        });
      }
    }
  });

export const policyAnalysisThemeSummarySchema = z.object({
  schemaVersion: z
    .literal(POLICY_ANALYSIS_SCHEMA_VERSION)
    .default(POLICY_ANALYSIS_SCHEMA_VERSION),
  apiVersion: z.literal(PUBLIC_API_VERSION),
  theme: policyAnalysisDimensionKeySchema,
  canonicalUrl: z.string().url(),
  publicJsonUrl: z.string().url(),
  generatedAt: z.string().datetime(),
  releaseId: z.string().min(1).optional(),
  totalProfiles: z.number().int().nonnegative(),
  statusCounts: z.record(analysisDimensionStatusSchema, z.number().int().nonnegative()),
  profiles: z.array(
    z.object({
      entitySlug: z.string().min(1),
      entityName: z.string().min(1),
      status: analysisDimensionStatusSchema,
      reviewState: analysisReviewStateSchema,
      confidence: z.number().min(0).max(1),
      evidenceCount: z.number().int().nonnegative(),
      sourceCount: z.number().int().nonnegative(),
      canonicalUrl: z.string().url(),
      publicJsonUrl: z.string().url()
    })
  ),
  limitations: z.array(z.string().min(1)).default([NO_ADVICE_BOUNDARY])
});

const publicAnalysisEnvelopeBaseSchema = z.object({
  apiVersion: z.literal(PUBLIC_API_VERSION),
  generatedAt: z.string().datetime(),
  canonicalUrl: z.string().url(),
  license: trackerMetadataLicenseSchema.default(TRACKER_METADATA_LICENSE),
  trackerMetadataLicense: trackerMetadataLicenseSchema.default(
    TRACKER_METADATA_LICENSE
  ),
  sourcePolicy: z.string().min(1).default(OFFICIAL_SOURCE_RIGHTS_CAVEAT),
  sourceRightsPolicy: z.string().min(1).default(OFFICIAL_SOURCE_RIGHTS_CAVEAT),
  limitations: z.array(z.string().min(1)).default([NO_ADVICE_BOUNDARY]),
  citation: publicApiCitationSchema
});

export const policyAnalysisProfileResponseSchema =
  publicAnalysisEnvelopeBaseSchema.extend({
    data: policyAnalysisProfileSchema
  });

export const policyAnalysisThemeSummaryResponseSchema =
  publicAnalysisEnvelopeBaseSchema.extend({
    data: policyAnalysisThemeSummarySchema
  });

export const policyAnalysisIndexDataSchema = z.object({
  name: z.string().min(1),
  purpose: z.string().min(1),
  schemaVersion: z.literal(POLICY_ANALYSIS_SCHEMA_VERSION),
  apiVersion: z.literal(PUBLIC_API_VERSION),
  dimensions: z.array(
    z.object({
      key: policyAnalysisDimensionKeySchema,
      label: z.string().min(1),
      description: z.string().min(1)
    })
  ),
  endpoints: z.array(
    z.object({
      label: z.string().min(1),
      path: z.string().regex(/^\/api\/public\/v1\/.+/),
      templatePath: z.string().regex(/^\/api\/public\/v1\/.+/).optional(),
      description: z.string().min(1)
    })
  ),
  limitations: z.array(z.string().min(1)).default([NO_ADVICE_BOUNDARY])
});

export const policyAnalysisIndexResponseSchema =
  publicAnalysisEnvelopeBaseSchema.extend({
    data: policyAnalysisIndexDataSchema
  });

export type AnalysisReviewState = z.infer<typeof analysisReviewStateSchema>;
export type AnalysisDimensionStatus = z.infer<
  typeof analysisDimensionStatusSchema
>;
export type PolicyAnalysisDimensionKey = z.infer<
  typeof policyAnalysisDimensionKeySchema
>;
export type PolicyCoverageScoreLabel = z.infer<
  typeof policyCoverageScoreLabelSchema
>;
export type AnalysisSourceBasis = z.infer<typeof analysisSourceBasisSchema>;
export type PolicyAnalysisDimension = z.infer<
  typeof policyAnalysisDimensionSchema
>;
export type PolicyCoverageScoreComponent = z.infer<
  typeof policyCoverageScoreComponentSchema
>;
export type PolicyCoverageScore = z.infer<typeof policyCoverageScoreSchema>;
export type PolicyAnalysisProfile = z.infer<
  typeof policyAnalysisProfileSchema
>;
export type PolicyAnalysisThemeSummary = z.infer<
  typeof policyAnalysisThemeSummarySchema
>;
export type PolicyAnalysisProfileResponse = z.infer<
  typeof policyAnalysisProfileResponseSchema
>;
export type PolicyAnalysisThemeSummaryResponse = z.infer<
  typeof policyAnalysisThemeSummaryResponseSchema
>;
export type PolicyAnalysisIndexData = z.infer<
  typeof policyAnalysisIndexDataSchema
>;
export type PolicyAnalysisIndexResponse = z.infer<
  typeof policyAnalysisIndexResponseSchema
>;

function sumNumbers(values: number[]): number {
  return Number(values.reduce((total, value) => total + value, 0).toFixed(6));
}
