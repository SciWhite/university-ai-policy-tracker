import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  contributionPolicyDataSchema,
  contributionPolicyResponseSchema,
  type ContributionField,
  type ContributionPolicyData,
  type ContributionPolicyResponse,
  type ContributionWorkflow,
  type ReviewQueueDefinition
} from "@uapt/shared";
import { getAbsoluteSiteUrl } from "./site-url";

export const githubRepositoryUrl =
  "https://github.com/SciWhite/university-ai-policy-tracker";

const issueTemplateBaseUrl = `${githubRepositoryUrl}/issues/new?template=`;

function field(
  name: string,
  label: string,
  required: boolean,
  description: string
): ContributionField {
  return { name, label, required, description };
}

export const contributionWorkflows: ContributionWorkflow[] = [
  {
    type: "official_source_url",
    label: "Submit an official source URL",
    description:
      "Suggest a public university AI policy, teaching guidance, academic integrity, privacy, procurement, or security-review source.",
    reviewQueue: "source_discovery_review",
    githubIssueTemplate: "submit-policy-source.yml",
    githubIssueUrl: `${issueTemplateBaseUrl}submit-policy-source.yml`,
    requiredFields: [
      field("institutionName", "Institution name", true, "University or institution name."),
      field("sourceUrl", "Official source URL", true, "Public URL to the source page or document."),
      field("sourceLanguage", "Source language", true, "Language of the original source evidence."),
      field("sourceType", "Source type", true, "Policy page, guidance page, PDF, or other official source.")
    ],
    optionalFields: [
      field("relevantExcerpt", "Relevant short excerpt", false, "Short original-language excerpt only; do not paste a full page or syllabus."),
      field("notes", "Notes", false, "Context that helps reviewers verify the source.")
    ],
    acceptsCourseEvidence: false,
    createsCanonicalFact: false,
    createsReviewTask: true,
    sourceFirst: true
  },
  {
    type: "policy_change_report",
    label: "Report a policy change",
    description:
      "Report that an existing tracked source changed or that a university added, moved, removed, or blocked an AI policy source.",
    reviewQueue: "claim_evidence_review",
    githubIssueTemplate: "report-policy-change.yml",
    githubIssueUrl: `${issueTemplateBaseUrl}report-policy-change.yml`,
    requiredFields: [
      field("institutionName", "Institution name", true, "Tracked or candidate institution name."),
      field("sourceUrl", "Source URL", true, "URL that changed or now redirects, blocks, or differs from the tracker record."),
      field("changeObservedAt", "Change observed date", true, "Date when the change was observed."),
      field("changeSummary", "Change summary", true, "Short factual summary of the observed change.")
    ],
    optionalFields: [
      field("previousTrackerUrl", "Tracker page or JSON URL", false, "Current tracker page, JSON URL, or change page if known."),
      field("evidenceSnippet", "Short source excerpt", false, "Short original-language excerpt supporting the reported change.")
    ],
    acceptsCourseEvidence: false,
    createsCanonicalFact: false,
    createsReviewTask: true,
    sourceFirst: true
  },
  {
    type: "institution_correction",
    label: "Submit an institution correction",
    description:
      "Request correction of an institution name, source attribution, review-state interpretation, or canonical page metadata.",
    reviewQueue: "institution_correction_review",
    githubIssueTemplate: "institution-correction.yml",
    githubIssueUrl: `${issueTemplateBaseUrl}institution-correction.yml`,
    requiredFields: [
      field("institutionName", "Institution name", true, "Institution affected by the correction."),
      field("trackerUrl", "Tracker URL", true, "Public tracker page or JSON URL being corrected."),
      field("correctionType", "Correction type", true, "Name, source URL, metadata, review-state, or other correction."),
      field("evidenceUrl", "Supporting source URL", true, "Official or clearly attributable source supporting the correction.")
    ],
    optionalFields: [
      field("officialRole", "Official role", false, "Institutional role if submitting on behalf of an institution."),
      field("shortExplanation", "Short explanation", false, "Factual correction summary.")
    ],
    acceptsCourseEvidence: false,
    createsCanonicalFact: false,
    createsReviewTask: true,
    sourceFirst: true
  },
  {
    type: "course_policy_submission",
    label: "Submit a course AI policy",
    description:
      "Submit structured course-level AI policy evidence. Course data remains pending until moderation, rights, and claim/evidence review are complete.",
    reviewQueue: "course_submission_review",
    githubIssueTemplate: "course-ai-policy.yml",
    githubIssueUrl: `${issueTemplateBaseUrl}course-ai-policy.yml`,
    requiredFields: [
      field("institutionName", "Institution name", true, "Institution that offers the course."),
      field("courseCode", "Course code or title", true, "Course code, course title, or both."),
      field("term", "Term", true, "Academic term such as Fall 2026."),
      field("sourceType", "Source type", true, "Public syllabus URL, uploaded excerpt reference, LMS screenshot description, or instructor-provided text."),
      field("policyExcerpt", "Short original-language excerpt", true, "Short excerpt only; do not paste a full copyrighted syllabus.")
    ],
    optionalFields: [
      field("instructorName", "Instructor name", false, "Only include if already public in course materials."),
      field("aiUseSummary", "AI use summary", false, "Structured factual summary, not advice."),
      field("disclosureRule", "Disclosure rule", false, "Whether disclosure is required, conditional, prohibited, or unknown.")
    ],
    acceptsCourseEvidence: true,
    createsCanonicalFact: false,
    createsReviewTask: true,
    sourceFirst: true
  },
  {
    type: "translation_correction",
    label: "Submit a translation or evidence-display correction",
    description:
      "Correct localized display text while preserving the original-language evidence as canonical.",
    reviewQueue: "translation_review",
    githubIssueTemplate: "translation-evidence-correction.yml",
    githubIssueUrl: `${issueTemplateBaseUrl}translation-evidence-correction.yml`,
    requiredFields: [
      field("trackerUrl", "Tracker URL", true, "Page or JSON URL containing the display text."),
      field("sourceLanguage", "Source language", true, "Original evidence language."),
      field("currentDisplayText", "Current display text", true, "Localized/helper text that needs correction."),
      field("suggestedDisplayText", "Suggested display text", true, "Replacement helper text.")
    ],
    optionalFields: [
      field("sourceUrl", "Source URL", false, "Original source URL if relevant."),
      field("notes", "Notes", false, "Reason the display text should change.")
    ],
    acceptsCourseEvidence: false,
    createsCanonicalFact: false,
    createsReviewTask: true,
    sourceFirst: true
  },
  {
    type: "dataset_issue",
    label: "Report a dataset or API issue",
    description:
      "Report broken JSON, stale links, checksum issues, field-shape problems, or inconsistency between public pages and public JSON.",
    reviewQueue: "claim_evidence_review",
    githubIssueTemplate: "dataset-issue.yml",
    githubIssueUrl: `${issueTemplateBaseUrl}dataset-issue.yml`,
    requiredFields: [
      field("affectedUrl", "Affected URL", true, "Public page, API endpoint, dataset artifact, or feed URL."),
      field("issueSummary", "Issue summary", true, "Short description of the inconsistency or bug."),
      field("expectedBehavior", "Expected behavior", true, "What the public contract should show.")
    ],
    optionalFields: [
      field("observedPayload", "Observed payload excerpt", false, "Small relevant excerpt only."),
      field("reproductionSteps", "Reproduction steps", false, "Steps or command used to observe the issue.")
    ],
    acceptsCourseEvidence: false,
    createsCanonicalFact: false,
    createsReviewTask: true,
    sourceFirst: false
  }
];

export const reviewQueues: ReviewQueueDefinition[] = [
  {
    queue: "source_discovery_review",
    label: "Source discovery review",
    purpose: "Verify that suggested URLs are public, attributable, source-language labeled, and relevant to university AI policy.",
    publicationGate: "A source can be staged only after reviewers confirm provenance, rights caveats, source language, and crawlability."
  },
  {
    queue: "crawl_failure_review",
    label: "Crawl failure review",
    purpose: "Separate inaccessible, blocked, redirected, no-policy, and weak-source cases before extraction.",
    publicationGate: "Failure records can be published only as labeled status metadata, not as policy conclusions."
  },
  {
    queue: "claim_evidence_review",
    label: "Claim/evidence review",
    purpose: "Check whether a proposed claim is supported by short original-language evidence and source attribution.",
    publicationGate: "Claims remain candidate records until evidence, confidence, review state, and citation fields pass review."
  },
  {
    queue: "analysis_profile_review",
    label: "Analysis profile review",
    purpose: "Review deterministic policy dimensions, coverage-score caveats, not-mentioned reasoning, basis claim IDs, and page-quality gates before analysis metadata graduates beyond machine-candidate status.",
    publicationGate: "Analysis profiles remain machine_candidate until reviewers confirm source-backed dimensions, original-language evidence, review-state separation, and no-advice boundaries."
  },
  {
    queue: "translation_review",
    label: "Translation review",
    purpose: "Review localized display summaries without replacing source-language evidence.",
    publicationGate: "Translation changes can affect helper display only; original evidence remains canonical."
  },
  {
    queue: "institution_correction_review",
    label: "Institution correction review",
    purpose: "Handle official corrections, metadata fixes, attribution disputes, and canonical page adjustments.",
    publicationGate: "Corrections must preserve audit history and cite the official or attributable evidence used."
  },
  {
    queue: "course_submission_review",
    label: "Course submission review",
    purpose: "Moderate course-level AI policy evidence, privacy concerns, copyright limits, and source context.",
    publicationGate: "Course records reuse claim/evidence and remain pending until moderation and rights checks pass."
  },
  {
    queue: "abuse_moderation_review",
    label: "Abuse and moderation review",
    purpose: "Reject personal attacks, private data, doxxing, unsupported accusations, and full copyrighted materials.",
    publicationGate: "Rejected or unsafe submissions are not converted into public facts."
  }
];

export function buildContributionPolicyData(): ContributionPolicyData {
  return contributionPolicyDataSchema.parse({
    status: "review-task-intake-alpha",
    apiVersion: PUBLIC_API_VERSION,
    publicApiMutationAllowed: false,
    submissionChannel: "github_issue_templates",
    submissionCreatesReviewTask: true,
    submissionCreatesCanonicalFact: false,
    workflows: contributionWorkflows,
    reviewQueues,
    privacyRules: [
      "Do not submit private student information.",
      "Do not submit non-public instructor personal data.",
      "Course submissions should include only public course context or short evidence excerpts needed for review.",
      "Institutional role claims may be noted, but public review still requires source evidence."
    ],
    copyrightRules: [
      "Do not paste full copyrighted syllabi, PDFs, LMS pages, or source pages.",
      "Use short original-language excerpts only when necessary for evidence review.",
      "Tracker metadata can be open licensed, but source documents retain their original rights.",
      "Raw source materials should not be added to Git unless explicitly approved."
    ],
    moderationRules: [
      "No doxxing, harassment, personal attacks, or unsupported accusations.",
      "No requests for legal advice or academic integrity advice.",
      "No login-wall, paywall, robots, or access-control bypass requests.",
      "Candidate records must stay labeled until reviewed."
    ],
    publicationRules: [
      "Submissions create review tasks, not canonical facts.",
      "Every published claim must keep source URL, source language, evidence snippet, confidence, and review state.",
      "Confidence and review state remain separate.",
      "Original-language evidence remains canonical; localized display is helper text only.",
      "Analysis profiles stay machine_candidate until analysis profile review confirms evidence binding, quality gates, and reuse caveats.",
      "Institution corrections preserve audit history."
    ],
    limitations: [NO_ADVICE_BOUNDARY]
  });
}

export function buildContributionPolicyResponse(
  generatedAt = new Date().toISOString()
): ContributionPolicyResponse {
  const canonicalUrl = getAbsoluteSiteUrl("/contribute");
  const publicJsonUrl = getAbsoluteSiteUrl(
    `/api/public/${PUBLIC_API_VERSION}/contributions/index.json`
  );

  return contributionPolicyResponseSchema.parse({
    apiVersion: PUBLIC_API_VERSION,
    generatedAt,
    canonicalUrl,
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: [NO_ADVICE_BOUNDARY],
    citation: {
      citationTitle: "University AI Policy Tracker contribution policy",
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        "University AI Policy Tracker contribution policy. University AI Policy Tracker. Version v1. " +
        canonicalUrl,
      sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT
    },
    data: buildContributionPolicyData()
  });
}

export function buildReviewPolicyResponse(
  generatedAt = new Date().toISOString()
): ContributionPolicyResponse {
  const canonicalUrl = getAbsoluteSiteUrl("/review");
  const publicJsonUrl = getAbsoluteSiteUrl(
    `/api/public/${PUBLIC_API_VERSION}/contributions/review-policy.json`
  );

  return contributionPolicyResponseSchema.parse({
    ...buildContributionPolicyResponse(generatedAt),
    canonicalUrl,
    citation: {
      citationTitle: "University AI Policy Tracker review policy",
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        "University AI Policy Tracker review policy. University AI Policy Tracker. Version v1. " +
        canonicalUrl,
      sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT
    }
  });
}
