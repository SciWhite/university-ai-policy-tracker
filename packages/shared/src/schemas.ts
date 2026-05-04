import { z } from "zod";
import {
  academicContexts,
  aiServiceStatuses,
  aiTools,
  audiences,
  dataSensitivities,
  documentStatuses,
  evidenceQualities,
  governanceThemes,
  policyAuthorities,
  reviewStates,
  serviceTreatments
} from "./taxonomy";

export const aiToolSchema = z.enum(aiTools);
export const documentStatusSchema = z.enum(documentStatuses);
export const policyAuthoritySchema = z.enum(policyAuthorities);
export const aiServiceStatusSchema = z.enum(aiServiceStatuses);
export const serviceTreatmentSchema = z.enum(serviceTreatments);
export const governanceThemeSchema = z.enum(governanceThemes);
export const audienceSchema = z.enum(audiences);
export const academicContextSchema = z.enum(academicContexts);
export const dataSensitivitySchema = z.enum(dataSensitivities);
export const evidenceQualitySchema = z.enum(evidenceQualities);
export const reviewStateSchema = z.enum(reviewStates);

export const sourceEvidenceSchema = z.object({
  url: z.string().url(),
  finalUrl: z.string().url().optional(),
  title: z.string().min(1).optional(),
  retrievedAt: z.string().datetime(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  quote: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  evidenceQuality: evidenceQualitySchema.default("official_source")
});

export const policyClassificationSchema = z.object({
  universitySlug: z.string().min(1),
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
  confidence: z.number().min(0).max(1),
  reviewState: reviewStateSchema
});

export const seedPolicySourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  documentStatus: documentStatusSchema,
  serviceTreatment: serviceTreatmentSchema,
  reviewState: reviewStateSchema,
  themes: z.array(governanceThemeSchema),
  tools: z.array(aiToolSchema),
  lastCheckedAt: z.string().datetime().optional(),
  lastChangedAt: z.string().datetime().optional()
});

export const seedUniversitySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  country: z.string().min(1),
  region: z.string().min(1),
  website: z.string().url(),
  summary: z.string().min(1),
  sources: z.array(seedPolicySourceSchema)
});

export type AiTool = z.infer<typeof aiToolSchema>;
export type DocumentStatus = z.infer<typeof documentStatusSchema>;
export type PolicyAuthority = z.infer<typeof policyAuthoritySchema>;
export type AiServiceStatus = z.infer<typeof aiServiceStatusSchema>;
export type ServiceTreatment = z.infer<typeof serviceTreatmentSchema>;
export type GovernanceTheme = z.infer<typeof governanceThemeSchema>;
export type Audience = z.infer<typeof audienceSchema>;
export type AcademicContext = z.infer<typeof academicContextSchema>;
export type DataSensitivity = z.infer<typeof dataSensitivitySchema>;
export type EvidenceQuality = z.infer<typeof evidenceQualitySchema>;
export type ReviewState = z.infer<typeof reviewStateSchema>;
export type SourceEvidence = z.infer<typeof sourceEvidenceSchema>;
export type PolicyClassification = z.infer<typeof policyClassificationSchema>;
export type SeedPolicySource = z.infer<typeof seedPolicySourceSchema>;
export type SeedUniversity = z.infer<typeof seedUniversitySchema>;
