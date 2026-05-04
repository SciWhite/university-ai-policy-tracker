export const aiTools = [
  "chatgpt",
  "microsoft_copilot",
  "deepseek",
  "gemini",
  "claude"
] as const;

export type AiTool = (typeof aiTools)[number];

export const documentStatuses = [
  "university_wide_policy",
  "specific_unit_policy_or_guidance",
  "external_policy_or_guidance",
  "no_policy",
  "inaccessible"
] as const;

export type DocumentStatus = (typeof documentStatuses)[number];

export const serviceTreatments = [
  "allowed",
  "conditionally_allowed",
  "restricted_or_blocked",
  "not_mentioned"
] as const;

export type ServiceTreatment = (typeof serviceTreatments)[number];

export const governanceThemes = [
  "data_entry",
  "privacy",
  "copyright",
  "academic_integrity",
  "teaching",
  "research",
  "security_review",
  "login_or_authentication",
  "procurement"
] as const;

export type GovernanceTheme = (typeof governanceThemes)[number];

export const reviewStates = [
  "machine_extracted",
  "agent_reviewed",
  "human_reviewed",
  "needs_review"
] as const;

export type ReviewState = (typeof reviewStates)[number];

export interface SourceEvidence {
  url: string;
  finalUrl?: string;
  title?: string;
  retrievedAt: string;
  contentHash?: string;
  quote?: string;
  location?: string;
}

export interface PolicyClassification {
  universitySlug: string;
  documentStatus: DocumentStatus;
  serviceTreatment: ServiceTreatment;
  aiTools: AiTool[];
  themes: GovernanceTheme[];
  evidence: SourceEvidence[];
  confidence: number;
  reviewState: ReviewState;
}
