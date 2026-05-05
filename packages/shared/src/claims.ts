import { z } from "zod";

export const TRACKER_METADATA_LICENSE = "CC-BY-4.0";
export const OFFICIAL_SOURCE_RIGHTS_CAVEAT =
  "Tracker metadata is open licensed. Official source documents, page text, PDFs, and other source materials retain their original rights and terms.";
export const DEFAULT_PUBLIC_SITE_BASE_URL =
  "https://university-ai-policy-tracker.example";

export const canonicalEntityTypeSchema = z.enum([
  "university",
  "tool",
  "region",
  "theme",
  "course"
]);

export const policyClaimTypeSchema = z.enum([
  "ai_tool_treatment",
  "academic_integrity",
  "privacy",
  "teaching",
  "research",
  "security_review",
  "procurement",
  "source_status",
  "other"
]);

export const claimReviewStateSchema = z.enum([
  "machine_candidate",
  "agent_reviewed",
  "human_reviewed",
  "needs_review",
  "rejected"
]);

export const sourceTypeSchema = z.enum([
  "official_policy_page",
  "official_guidance",
  "official_pdf",
  "archived_official_source",
  "other"
]);

export const trackerMetadataLicenseSchema = z.literal(TRACKER_METADATA_LICENSE);

export const sourceAttributionSchema = z.object({
  id: z.string().min(1).optional(),
  sourceUrl: z.string().url(),
  finalUrl: z.string().url().optional(),
  citationTitle: z.string().min(1),
  publisher: z.string().min(1).optional(),
  retrievedAt: z.string().datetime().optional(),
  snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceType: sourceTypeSchema.default("official_policy_page"),
  official: z.boolean().default(true),
  sourceRights: z.string().min(1).default(OFFICIAL_SOURCE_RIGHTS_CAVEAT)
});

export const claimEvidenceSchema = z.object({
  id: z.string().min(1).optional(),
  sourceUrl: z.string().url(),
  sourceSnapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  evidenceSnippet: z.string().min(1).max(700),
  snippetLocation: z.string().min(1).optional(),
  retrievedAt: z.string().datetime().optional(),
  attribution: sourceAttributionSchema
});

export const policyClaimSchema = z.object({
  id: z.string().min(1).optional(),
  entitySlug: z.string().min(1),
  entityType: canonicalEntityTypeSchema.default("university"),
  claimType: policyClaimTypeSchema,
  claimText: z.string().min(1),
  claimValue: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1),
  reviewState: claimReviewStateSchema,
  lastCheckedAt: z.string().datetime().optional(),
  lastChangedAt: z.string().datetime().optional(),
  evidence: z.array(claimEvidenceSchema).min(1)
});

export const canonicalEntitySchema = z.object({
  id: z.string().min(1).optional(),
  type: canonicalEntityTypeSchema,
  slug: z.string().min(1),
  name: z.string().min(1),
  canonicalUrl: z.string().url(),
  aliases: z.array(z.string().min(1)).default([]),
  summary: z.string().min(1).optional()
});

export const citationPolicySchema = z.object({
  trackerMetadataLicense: trackerMetadataLicenseSchema.default(
    TRACKER_METADATA_LICENSE
  ),
  sourceDocumentsRights: z.string().min(1).default(OFFICIAL_SOURCE_RIGHTS_CAVEAT),
  requiredPublicClaimFields: z
    .array(z.string().min(1))
    .default([
      "sourceUrl",
      "sourceSnapshotHash",
      "evidenceSnippet",
      "confidence",
      "reviewState"
    ]),
  llmsTxtIsAuxiliaryGuide: z.literal(true).default(true)
});

export const publicEntitySummarySchema = z.object({
  citationTitle: z.string().min(1),
  canonicalUrl: z.string().url(),
  entity: canonicalEntitySchema,
  summary: z.string().min(1),
  lastCheckedAt: z.string().datetime().optional(),
  lastChangedAt: z.string().datetime().optional(),
  confidence: z.number().min(0).max(1).optional(),
  reviewState: claimReviewStateSchema,
  license: trackerMetadataLicenseSchema.default(TRACKER_METADATA_LICENSE),
  sourcePolicy: z.string().min(1).default(OFFICIAL_SOURCE_RIGHTS_CAVEAT),
  officialSources: z.array(sourceAttributionSchema),
  claims: z.array(policyClaimSchema),
  suggestedCitation: z.string().min(1)
});

export const publicRecentChangeSchema = z.object({
  entitySlug: z.string().min(1),
  entityName: z.string().min(1),
  canonicalUrl: z.string().url(),
  citationTitle: z.string().min(1),
  lastCheckedAt: z.string().datetime().optional(),
  lastChangedAt: z.string().datetime().optional(),
  reviewState: claimReviewStateSchema,
  claimCount: z.number().int().nonnegative(),
  claims: z.array(policyClaimSchema)
});

export const publicRecentChangesResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  license: trackerMetadataLicenseSchema.default(TRACKER_METADATA_LICENSE),
  sourcePolicy: z.string().min(1).default(OFFICIAL_SOURCE_RIGHTS_CAVEAT),
  changes: z.array(publicRecentChangeSchema)
});

export const claimReviewDecisionSchema = z.object({
  claimId: z.string().min(1),
  decision: z.enum(["approve", "reject", "needs_changes"]),
  reviewState: claimReviewStateSchema,
  reviewer: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
  decidedAt: z.string().datetime()
});

export type CanonicalEntityType = z.infer<typeof canonicalEntityTypeSchema>;
export type PolicyClaimType = z.infer<typeof policyClaimTypeSchema>;
export type ClaimReviewState = z.infer<typeof claimReviewStateSchema>;
export type SourceType = z.infer<typeof sourceTypeSchema>;
export type SourceAttribution = z.infer<typeof sourceAttributionSchema>;
export type ClaimEvidence = z.infer<typeof claimEvidenceSchema>;
export type PolicyClaim = z.infer<typeof policyClaimSchema>;
export type CanonicalEntity = z.infer<typeof canonicalEntitySchema>;
export type CitationPolicy = z.infer<typeof citationPolicySchema>;
export type PublicEntitySummary = z.infer<typeof publicEntitySummarySchema>;
export type PublicRecentChange = z.infer<typeof publicRecentChangeSchema>;
export type PublicRecentChangesResponse = z.infer<
  typeof publicRecentChangesResponseSchema
>;
export type ClaimReviewDecision = z.infer<typeof claimReviewDecisionSchema>;
