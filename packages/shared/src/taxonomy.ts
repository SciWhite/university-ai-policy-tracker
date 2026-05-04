export const aiTools = [
  "chatgpt",
  "microsoft_copilot",
  "deepseek",
  "gemini",
  "claude",
  "institutional_ai_service"
] as const;

export const documentStatuses = [
  "university_wide_policy",
  "specific_unit_policy_or_guidance",
  "external_policy_or_guidance",
  "no_policy",
  "inaccessible"
] as const;

export const policyAuthorities = [
  "university_wide",
  "faculty_or_school",
  "department",
  "course_level",
  "it_or_security_office",
  "library",
  "teaching_and_learning_center",
  "research_office",
  "procurement_or_legal"
] as const;

export const aiServiceStatuses = [
  "institutionally_licensed_or_procured",
  "third_party_service",
  "self_hosted_system",
  "restricted_or_prohibited",
  "no_specific_ai_service_named"
] as const;

export const serviceTreatments = [
  "allowed",
  "conditionally_allowed",
  "restricted_or_blocked",
  "not_mentioned"
] as const;

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

export const audiences = [
  "students",
  "faculty",
  "staff",
  "researchers",
  "administrators"
] as const;

export const academicContexts = [
  "assignment",
  "exam",
  "thesis",
  "research",
  "teaching_preparation",
  "administrative_work"
] as const;

export const dataSensitivities = [
  "public_data",
  "internal_data",
  "student_records",
  "personally_identifiable_information",
  "confidential_research",
  "regulated_data"
] as const;

export const evidenceQualities = [
  "official_source",
  "archived_official_source",
  "pdf",
  "third_party_mention",
  "unclear"
] as const;

export const reviewStates = [
  "machine_extracted",
  "agent_reviewed",
  "human_reviewed",
  "needs_review"
] as const;
