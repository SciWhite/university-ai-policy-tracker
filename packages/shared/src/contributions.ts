import { z } from "zod";
import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  publicApiCitationSchema
} from "./claims";

export const contributionTypeSchema = z.enum([
  "official_source_url",
  "policy_change_report",
  "institution_correction",
  "course_policy_submission",
  "translation_correction",
  "dataset_issue"
]);

export const contributionReviewQueueSchema = z.enum([
  "source_discovery_review",
  "crawl_failure_review",
  "extraction_review",
  "analysis_profile_review",
  "claim_evidence_review",
  "translation_review",
  "institution_correction_review",
  "course_submission_review",
  "abuse_moderation_review"
]);

export const contributionFieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean(),
  description: z.string().min(1)
});

export const contributionWorkflowSchema = z.object({
  type: contributionTypeSchema,
  label: z.string().min(1),
  description: z.string().min(1),
  reviewQueue: contributionReviewQueueSchema,
  githubIssueTemplate: z.string().min(1),
  githubIssueUrl: z.string().url(),
  requiredFields: z.array(contributionFieldSchema).min(1),
  optionalFields: z.array(contributionFieldSchema).default([]),
  createsCanonicalFact: z.literal(false).default(false),
  createsReviewTask: z.literal(true).default(true),
  sourceFirst: z.boolean().default(true),
  acceptsCourseEvidence: z.boolean().default(false)
});

export const reviewQueueDefinitionSchema = z.object({
  queue: contributionReviewQueueSchema,
  label: z.string().min(1),
  purpose: z.string().min(1),
  publicationGate: z.string().min(1)
});

export const contributionPolicyDataSchema = z.object({
  status: z.literal("review-task-intake-alpha"),
  apiVersion: z.literal(PUBLIC_API_VERSION),
  publicApiMutationAllowed: z.literal(false),
  submissionChannel: z.literal("github_issue_templates"),
  submissionCreatesReviewTask: z.literal(true),
  submissionCreatesCanonicalFact: z.literal(false),
  workflows: z.array(contributionWorkflowSchema).min(1),
  reviewQueues: z.array(reviewQueueDefinitionSchema).min(1),
  privacyRules: z.array(z.string().min(1)).min(1),
  copyrightRules: z.array(z.string().min(1)).min(1),
  moderationRules: z.array(z.string().min(1)).min(1),
  publicationRules: z.array(z.string().min(1)).min(1),
  limitations: z.array(z.string().min(1)).default([NO_ADVICE_BOUNDARY])
});

const publicApiEnvelopeBaseSchema = z.object({
  apiVersion: z.literal(PUBLIC_API_VERSION),
  generatedAt: z.string().datetime(),
  canonicalUrl: z.string().url(),
  license: z.literal(TRACKER_METADATA_LICENSE).default(TRACKER_METADATA_LICENSE),
  trackerMetadataLicense: z
    .literal(TRACKER_METADATA_LICENSE)
    .default(TRACKER_METADATA_LICENSE),
  sourcePolicy: z.string().min(1).default(OFFICIAL_SOURCE_RIGHTS_CAVEAT),
  sourceRightsPolicy: z.string().min(1).default(OFFICIAL_SOURCE_RIGHTS_CAVEAT),
  limitations: z.array(z.string().min(1)).default([NO_ADVICE_BOUNDARY]),
  citation: publicApiCitationSchema
});

export const contributionPolicyResponseSchema =
  publicApiEnvelopeBaseSchema.extend({
    data: contributionPolicyDataSchema
  });

export type ContributionType = z.infer<typeof contributionTypeSchema>;
export type ContributionReviewQueue = z.infer<
  typeof contributionReviewQueueSchema
>;
export type ContributionField = z.infer<typeof contributionFieldSchema>;
export type ContributionWorkflow = z.infer<typeof contributionWorkflowSchema>;
export type ReviewQueueDefinition = z.infer<
  typeof reviewQueueDefinitionSchema
>;
export type ContributionPolicyData = z.infer<
  typeof contributionPolicyDataSchema
>;
export type ContributionPolicyResponse = z.infer<
  typeof contributionPolicyResponseSchema
>;
