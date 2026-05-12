import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  POLICY_ANALYSIS_SCHEMA_VERSION,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  policyAnalysisCoverageScoresResponseSchema,
  policyAnalysisDimensionKeySchema,
  policyAnalysisIndexResponseSchema,
  policyAnalysisProfileResponseSchema,
  policyAnalysisProfileSchema,
  type AnalysisDimensionStatus,
  type AnalysisReviewState,
  type PolicyAnalysisCoverageScoresResponse,
  type PolicyAnalysisDimension,
  type PolicyAnalysisDimensionKey,
  type PolicyAnalysisIndexResponse,
  type PolicyAnalysisProfile,
  type PolicyAnalysisProfileResponse,
  type PolicyClaim,
  type PublicApiCitation,
  type PublicEntitySummary
} from "@uapt/shared";
import { getSiteBaseUrl } from "./site-url";
import { getStagedPublicSummaries } from "./staged-public-data";

const ANALYSIS_LIMITATIONS = [
  "Policy analysis profiles are deterministic summaries of public tracker claims and are not final policy conclusions.",
  "Policy Coverage Score measures breadth of public, source-backed coverage; it is not a policy quality score, strictness score, legal adequacy score, safety score, or institutional compliance score.",
  NO_ADVICE_BOUNDARY
];

const REVIEW_STATE: AnalysisReviewState = "machine_candidate";
const DEFAULT_CONFIDENCE_PENALTY = 0.85;
const MAX_SUPPORTING_CLAIMS = 5;

interface DimensionDefinition {
  key: PolicyAnalysisDimensionKey;
  label: string;
  description: string;
  matchClaimTypes?: PolicyClaim["claimType"][];
  include: RegExp[];
  exclude?: RegExp[];
  defaultStatus: AnalysisDimensionStatus;
  normalizedValue: string;
  emptySummary: string;
  emptyReason: string;
}

const DIMENSION_DEFINITIONS: DimensionDefinition[] = [
  {
    key: "policy_presence",
    label: "Policy presence",
    description:
      "Whether the public record contains official AI policy or guidance sources.",
    matchClaimTypes: ["source_status"],
    include: [/policy|guidance|principle|framework|source|official/i],
    defaultStatus: "unclear",
    normalizedValue: "public_policy_or_guidance_source_present",
    emptySummary:
      "No source-backed public AI policy or guidance record is present in this profile.",
    emptyReason:
      "The current public tracker record does not contain a source-backed claim that establishes a policy or guidance source."
  },
  {
    key: "ai_disclosure",
    label: "AI disclosure",
    description:
      "Whether public guidance addresses disclosure, acknowledgement, citation, or declaration of AI use.",
    include: [
      /disclos|acknowledg|declar|citation|cite|citing|document(?:ing|ation)?|attribute|attribution/i
    ],
    defaultStatus: "required",
    normalizedValue: "ai_use_disclosure_or_acknowledgement_addressed",
    emptySummary:
      "No source-backed public claim about AI disclosure or acknowledgement is present in this profile.",
    emptyReason:
      "The current public tracker record does not contain claim evidence about disclosing, acknowledging, citing, or declaring AI use."
  },
  {
    key: "coursework",
    label: "Coursework",
    description:
      "Whether public guidance addresses coursework, assignments, syllabi, papers, homework, or submitted work.",
    matchClaimTypes: ["academic_integrity", "teaching", "ai_tool_treatment"],
    include: [
      /coursework|assignment|homework|syllabus|submitted work|work submitted|paper|essay|problem set|assessment|for credit|course\b|instructor|faculty/i
    ],
    exclude: [/exam|examination|test|quiz/i],
    defaultStatus: "conditionally_allowed",
    normalizedValue: "course_or_assignment_dependent",
    emptySummary:
      "No source-backed public claim about coursework AI use is present in this profile.",
    emptyReason:
      "The current public tracker record does not contain claim evidence about coursework, assignments, or syllabus-level AI use."
  },
  {
    key: "exams",
    label: "Exams",
    description:
      "Whether public guidance addresses exams, tests, quizzes, or examination conditions.",
    matchClaimTypes: ["academic_integrity", "teaching", "ai_tool_treatment"],
    include: [/exam|examination|test|quiz/i],
    defaultStatus: "restricted",
    normalizedValue: "exam_or_assessment_ai_use_addressed",
    emptySummary:
      "No source-backed public claim about exam AI use is present in this profile.",
    emptyReason:
      "The current public tracker record does not contain claim evidence about exams, tests, quizzes, or examination conditions."
  },
  {
    key: "privacy_data_entry",
    label: "Privacy and data entry",
    description:
      "Whether public guidance addresses personal, confidential, sensitive, regulated, or student data entry into AI tools.",
    matchClaimTypes: ["privacy"],
    include: [
      /privacy|confidential|sensitive|personal information|personal data|student data|student work|PII|PHI|FERPA|HIPAA|data protection|data security|upload|input|enter/i
    ],
    defaultStatus: "restricted",
    normalizedValue: "sensitive_or_confidential_data_restricted",
    emptySummary:
      "No source-backed public claim about privacy or data-entry restrictions is present in this profile.",
    emptyReason:
      "The current public tracker record does not contain claim evidence about personal, confidential, sensitive, regulated, or student data entry into AI tools."
  },
  {
    key: "academic_integrity",
    label: "Academic integrity",
    description:
      "Whether public guidance connects AI use to academic integrity, misconduct, dishonesty, plagiarism, or cheating rules.",
    matchClaimTypes: ["academic_integrity"],
    include: [
      /academic integrity|misconduct|dishonesty|cheating|plagiarism|unauthori[sz]ed|breach|violation|authorship|own work/i
    ],
    defaultStatus: "restricted",
    normalizedValue: "ai_use_subject_to_academic_integrity_rules",
    emptySummary:
      "No source-backed public claim about academic-integrity treatment of AI use is present in this profile.",
    emptyReason:
      "The current public tracker record does not contain claim evidence about AI use under academic integrity, misconduct, dishonesty, plagiarism, or cheating rules."
  },
  {
    key: "approved_tools",
    label: "Approved tools",
    description:
      "Whether public guidance identifies institutionally approved, licensed, procured, or enterprise AI tools.",
    matchClaimTypes: ["ai_tool_treatment", "procurement", "security_review"],
    include: [
      /approved|licensed|institutional|institutionally|procured|enterprise|provided|available to|issued account|managed account|university-approved|university approved/i
    ],
    defaultStatus: "allowed",
    normalizedValue: "approved_or_licensed_ai_tools_identified",
    emptySummary:
      "No source-backed public claim identifying approved or licensed AI tools is present in this profile.",
    emptyReason:
      "The current public tracker record does not contain claim evidence that identifies institutionally approved, licensed, procured, or enterprise AI tools."
  },
  {
    key: "named_ai_services",
    label: "Named AI services",
    description:
      "Whether public guidance names AI services such as ChatGPT, Copilot, Claude, Gemini, Grammarly, or DeepSeek.",
    matchClaimTypes: ["ai_tool_treatment", "procurement", "privacy"],
    include: [
      /ChatGPT|Copilot|DeepSeek|Claude|Gemini|Grammarly|NotebookLM|Microsoft Editor|OpenAI|Anthropic|Google AI|Microsoft/i
    ],
    defaultStatus: "unclear",
    normalizedValue: "named_ai_services_present",
    emptySummary:
      "No source-backed public claim naming a specific AI service is present in this profile.",
    emptyReason:
      "The current public tracker record does not contain claim evidence naming a specific AI service."
  },
  {
    key: "teaching_guidance",
    label: "Teaching guidance",
    description:
      "Whether public guidance addresses instructors, teaching, classroom policy, assessment design, or syllabus language.",
    matchClaimTypes: ["teaching"],
    include: [
      /teaching|instructor|faculty|classroom|syllabus|assessment design|lesson|student learning|course guidance|educator/i
    ],
    defaultStatus: "recommended",
    normalizedValue: "instructor_or_teaching_guidance_available",
    emptySummary:
      "No source-backed public claim about teaching guidance is present in this profile.",
    emptyReason:
      "The current public tracker record does not contain claim evidence about instructor, classroom, assessment-design, or syllabus guidance."
  },
  {
    key: "research_guidance",
    label: "Research guidance",
    description:
      "Whether public guidance addresses research use, publication ethics, research data, grants, or human-subjects compliance.",
    matchClaimTypes: ["research"],
    include: [
      /research|publication|publish|grant|human subjects|IRB|ethics review|research data|scholarship|authorship|peer review/i
    ],
    defaultStatus: "recommended",
    normalizedValue: "research_ai_guidance_available",
    emptySummary:
      "No source-backed public claim about research AI use is present in this profile.",
    emptyReason:
      "The current public tracker record does not contain claim evidence about research use, publication ethics, research data, grants, or human-subjects compliance."
  },
  {
    key: "security_procurement",
    label: "Security and procurement",
    description:
      "Whether public guidance addresses security review, procurement, vendor approval, risk assessment, authentication, SSO, or licensing.",
    matchClaimTypes: ["security_review", "procurement"],
    include: [
      /security review|risk assessment|procurement|vendor|approved vendor|SSO|single sign-on|authentication|licen[cs]ing|data governance|IT review|risk review|enterprise/i
    ],
    defaultStatus: "required",
    normalizedValue: "security_procurement_or_enterprise_review_addressed",
    emptySummary:
      "No source-backed public claim about AI security review or procurement is present in this profile.",
    emptyReason:
      "The current public tracker record does not contain claim evidence about security review, procurement, vendor approval, risk assessment, authentication, SSO, or enterprise licensing."
  }
];

const COVERAGE_COMPONENTS: Array<{
  key: PolicyAnalysisDimensionKey;
  label: string;
  maxPoints: number;
}> = [
  {
    key: "policy_presence",
    label: "Central AI policy or guidance source exists",
    maxPoints: 15
  },
  {
    key: "academic_integrity",
    label: "Academic integrity guidance",
    maxPoints: 15
  },
  {
    key: "ai_disclosure",
    label: "AI disclosure guidance",
    maxPoints: 15
  },
  {
    key: "coursework",
    label: "Coursework guidance",
    maxPoints: 10
  },
  {
    key: "exams",
    label: "Exam or assessment guidance",
    maxPoints: 10
  },
  {
    key: "privacy_data_entry",
    label: "Privacy or data-entry guidance",
    maxPoints: 15
  },
  {
    key: "approved_tools",
    label: "Approved tools, procurement, or licensed tools",
    maxPoints: 10
  },
  {
    key: "teaching_guidance",
    label: "Teaching or research guidance",
    maxPoints: 10
  }
];

let profilePromise: Promise<PolicyAnalysisProfile[]> | undefined;

export async function getPolicyAnalysisProfiles(): Promise<
  PolicyAnalysisProfile[]
> {
  profilePromise ??= buildPolicyAnalysisProfiles();

  return profilePromise;
}

export async function getPolicyAnalysisProfileBySlug(
  slug: string
): Promise<PolicyAnalysisProfile | undefined> {
  return (await getPolicyAnalysisProfiles()).find(
    (profile) => profile.entitySlug === slug
  );
}

export function getPolicyAnalysisDimensions() {
  return DIMENSION_DEFINITIONS.map(({ key, label, description }) => ({
    key,
    label,
    description
  }));
}

export function getPolicyAnalysisDimensionLabel(
  key: PolicyAnalysisDimensionKey
): string {
  return (
    DIMENSION_DEFINITIONS.find((definition) => definition.key === key)?.label ??
    key
  );
}

export function getPolicyAnalysisApiPath(slug: string): string {
  return `/api/public/${PUBLIC_API_VERSION}/analysis/universities/${slug}.json`;
}

export function buildPolicyAnalysisIndexResponse(
  generatedAt = new Date().toISOString()
): PolicyAnalysisIndexResponse {
  const siteBaseUrl = getSiteBaseUrl();
  const canonicalUrl = new URL("/datasets", siteBaseUrl).toString();
  const publicJsonUrl = new URL(
    `/api/public/${PUBLIC_API_VERSION}/analysis/index.json`,
    siteBaseUrl
  ).toString();

  return policyAnalysisIndexResponseSchema.parse({
    apiVersion: PUBLIC_API_VERSION,
    generatedAt,
    canonicalUrl,
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: ANALYSIS_LIMITATIONS,
    citation: buildCitation({
      citationTitle: "University AI Policy Tracker analysis API index",
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        "University AI Policy Tracker analysis API index. University AI Policy Tracker. Version v1. " +
        canonicalUrl
    }),
    data: {
      name: "University AI Policy Tracker analysis API",
      purpose:
        "Deterministic, evidence-backed policy analysis profiles derived from public claim/evidence records.",
      schemaVersion: POLICY_ANALYSIS_SCHEMA_VERSION,
      apiVersion: PUBLIC_API_VERSION,
      dimensions: getPolicyAnalysisDimensions(),
      endpoints: [
        {
          label: "Analysis API index",
          path: `/api/public/${PUBLIC_API_VERSION}/analysis/index.json`,
          description:
            "Manifest for deterministic policy analysis dimensions, endpoints, limitations, and version metadata."
        },
        {
          label: "University analysis profile",
          path: `/api/public/${PUBLIC_API_VERSION}/analysis/universities/anu.json`,
          templatePath: `/api/public/${PUBLIC_API_VERSION}/analysis/universities/{slug}.json`,
          description:
            "One source-backed analysis profile with dimensions, evidence claim IDs, source URLs, review state, confidence, and coverage score."
        },
        {
          label: "Coverage scores",
          path: `/api/public/${PUBLIC_API_VERSION}/analysis/coverage-scores.json`,
          description:
            "Coverage score list for public analysis profiles. Scores measure breadth of source-backed public coverage, not policy quality."
        }
      ],
      limitations: ANALYSIS_LIMITATIONS
    }
  });
}

export function buildPolicyAnalysisProfileResponse(
  profile: PolicyAnalysisProfile,
  generatedAt = new Date().toISOString()
): PolicyAnalysisProfileResponse {
  return policyAnalysisProfileResponseSchema.parse({
    apiVersion: PUBLIC_API_VERSION,
    generatedAt,
    canonicalUrl: profile.canonicalUrl,
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: profile.limitations,
    citation: buildCitation({
      citationTitle: `${profile.entityName} policy analysis profile`,
      canonicalUrl: profile.canonicalUrl,
      publicJsonUrl: profile.publicJsonUrl,
      suggestedCitation: profile.suggestedCitation
    }),
    data: profile
  });
}

export async function buildPolicyAnalysisCoverageScoresResponse(
  generatedAt = new Date().toISOString()
): Promise<PolicyAnalysisCoverageScoresResponse> {
  const siteBaseUrl = getSiteBaseUrl();
  const profiles = await getPolicyAnalysisProfiles();
  const canonicalUrl = new URL("/datasets", siteBaseUrl).toString();
  const publicJsonUrl = new URL(
    `/api/public/${PUBLIC_API_VERSION}/analysis/coverage-scores.json`,
    siteBaseUrl
  ).toString();

  return policyAnalysisCoverageScoresResponseSchema.parse({
    apiVersion: PUBLIC_API_VERSION,
    generatedAt,
    canonicalUrl,
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: ANALYSIS_LIMITATIONS,
    citation: buildCitation({
      citationTitle: "University AI Policy Tracker policy coverage scores",
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        "University AI Policy Tracker policy coverage scores. University AI Policy Tracker. Version v1. " +
        canonicalUrl
    }),
    data: {
      count: profiles.length,
      profiles: profiles.map((profile) => ({
        entitySlug: profile.entitySlug,
        entityName: profile.entityName,
        entityType: profile.entityType,
        canonicalUrl: profile.canonicalUrl,
        publicJsonUrl: profile.publicJsonUrl,
        score: profile.coverageScore.score,
        maxScore: profile.coverageScore.maxScore,
        label: profile.coverageScore.label,
        reviewState: profile.reviewState,
        confidence: profile.confidence,
        evidenceBackedDimensionCount: profile.dimensions.filter(
          (dimension) => dimension.evidenceClaimIds.length > 0
        ).length,
        notMentionedDimensionCount: profile.dimensions.filter(
          (dimension) => dimension.status === "not_mentioned"
        ).length,
        sourceLanguageCount: profile.sourceLanguages.length,
        limitations: profile.coverageScore.limitations
      }))
    }
  });
}

async function buildPolicyAnalysisProfiles(): Promise<PolicyAnalysisProfile[]> {
  const summaries = await getStagedPublicSummaries();

  return summaries
    .map(buildPolicyAnalysisProfile)
    .sort((left, right) => left.entityName.localeCompare(right.entityName));
}

function buildPolicyAnalysisProfile(
  summary: PublicEntitySummary
): PolicyAnalysisProfile {
  const generatedAt = latestIso(
    summary.claims.flatMap((claim) => [
      claim.lastChangedAt,
      claim.lastCheckedAt,
      ...claim.evidence.map((evidence) => evidence.retrievedAt)
    ])
  );
  const dimensions = DIMENSION_DEFINITIONS.map((definition) =>
    buildDimension(summary, definition)
  );
  const basedOnClaimIds = unique(
    dimensions.flatMap((dimension) => dimension.evidenceClaimIds)
  );
  const basedOnSourceUrls = unique(
    dimensions.flatMap((dimension) => dimension.evidenceSourceUrls)
  );
  const sourceLanguages = unique(
    dimensions.flatMap((dimension) => dimension.sourceLanguages)
  );
  const coverageScore = buildCoverageScore(dimensions);
  const publicJsonUrl = new URL(
    getPolicyAnalysisApiPath(summary.entity.slug),
    getSiteBaseUrl()
  ).toString();

  return policyAnalysisProfileSchema.parse({
    schemaVersion: POLICY_ANALYSIS_SCHEMA_VERSION,
    apiVersion: PUBLIC_API_VERSION,
    entityType: "university",
    entitySlug: summary.entity.slug,
    entityName: summary.entity.name,
    canonicalUrl: summary.canonicalUrl,
    publicJsonUrl,
    generatedAt: generatedAt ?? new Date().toISOString(),
    basedOnClaimIds,
    basedOnSourceUrls,
    sourceLanguages,
    reviewState: REVIEW_STATE,
    confidence: deriveProfileConfidence(dimensions),
    coverageScore,
    dimensions,
    limitations: ANALYSIS_LIMITATIONS,
    suggestedCitation:
      `University AI Policy Tracker. "${summary.entity.name} policy analysis profile." ` +
      `Version ${PUBLIC_API_VERSION}. ${summary.canonicalUrl}`
  });
}

function buildDimension(
  summary: PublicEntitySummary,
  definition: DimensionDefinition
): PolicyAnalysisDimension {
  const claims = selectClaims(summary.claims, definition);

  if (!claims.length) {
    return {
      key: definition.key,
      label: definition.label,
      status: "not_mentioned",
      summary: definition.emptySummary,
      explanation:
        "This is an absence-of-evidence marker for the current tracker profile, not proof that no such policy exists.",
      evidenceClaimIds: [],
      evidenceSourceUrls: [],
      sourceLanguages: [],
      reviewState: REVIEW_STATE,
      confidence: 0,
      evidenceCount: 0,
      sourceCount: 0,
      notMentionedReason: definition.emptyReason,
      basis: []
    };
  }

  const status = deriveStatus(definition, claims);
  const basis = claims.map((claim) => {
    const evidence = claim.evidence[0];

    return {
      claimId: claim.id ?? makeFallbackClaimId(summary.entity.slug, claim),
      sourceUrl: evidence.sourceUrl,
      sourceLanguage: evidence.sourceLanguage ?? "und",
      evidenceSnippet: evidence.evidenceSnippet,
      sourceSnapshotHash: evidence.sourceSnapshotHash,
      reviewState: normalizeBasisReviewState(claim.reviewState)
    };
  });
  const evidenceClaimIds = basis.map((item) => item.claimId);
  const evidenceSourceUrls = unique(basis.map((item) => item.sourceUrl));
  const sourceLanguages = unique(basis.map((item) => item.sourceLanguage));

  return {
    key: definition.key,
    label: definition.label,
    status,
    normalizedValue: deriveNormalizedValue(definition, status, claims),
    summary: buildDimensionSummary(summary.entity.name, definition, status, claims),
    explanation: buildDimensionExplanation(definition, status, claims),
    evidenceClaimIds,
    evidenceSourceUrls,
    sourceLanguages,
    reviewState: REVIEW_STATE,
    confidence: deriveDimensionConfidence(claims),
    evidenceCount: evidenceClaimIds.length,
    sourceCount: evidenceSourceUrls.length,
    basis
  };
}

function selectClaims(
  claims: PolicyClaim[],
  definition: DimensionDefinition
): PolicyClaim[] {
  const matches = claims.filter((claim) => {
    if (!claim.evidence.length) return false;

    const text = `${claim.claimType} ${claim.claimValue ?? ""} ${claim.claimText}`;
    const claimTypeMatch =
      definition.matchClaimTypes?.includes(claim.claimType) ?? false;
    const textMatch = definition.include.some((pattern) => pattern.test(text));
    const excluded = definition.exclude?.some((pattern) => pattern.test(text));

    return !excluded && (claimTypeMatch || textMatch);
  });

  return sortClaimsForAnalysis(matches).slice(0, MAX_SUPPORTING_CLAIMS);
}

function sortClaimsForAnalysis(claims: PolicyClaim[]): PolicyClaim[] {
  return [...claims].sort((left, right) => {
    const reviewDelta =
      reviewStateRank(right.reviewState) - reviewStateRank(left.reviewState);
    if (reviewDelta !== 0) return reviewDelta;

    const confidenceDelta = right.confidence - left.confidence;
    if (confidenceDelta !== 0) return confidenceDelta;

    return (left.id ?? left.claimText).localeCompare(right.id ?? right.claimText);
  });
}

function deriveStatus(
  definition: DimensionDefinition,
  claims: PolicyClaim[]
): AnalysisDimensionStatus {
  const text = claims.map((claim) => `${claim.claimValue ?? ""} ${claim.claimText}`).join(" ");

  if (definition.key === "policy_presence") return "unclear";
  if (definition.key === "teaching_guidance") return "recommended";

  if (definition.key === "ai_disclosure") {
    if (/disclos|acknowledg|declar|citation|cite|citing|document|attribute/i.test(text)) {
      return /must|required|mandatory|shall|need to|needs to|expect/i.test(text)
        ? "required"
        : "recommended";
    }

    return "unclear";
  }

  if (definition.key === "research_guidance") {
    if (/prohibit|restricted|confidential|sensitive|must not|may not|cannot|can't/i.test(text)) {
      return "restricted";
    }

    return "recommended";
  }

  if (/prohibit|prohibited|not permitted|not allowed|forbidden|blocked|must not|may not|cannot|can't/i.test(text)) {
    return /unless|except|permission|authorized|authorised|approved|instructor|syllabus|course/i.test(text)
      ? "restricted"
      : "blocked";
  }

  if (/restrict|restricted|sensitive|confidential|approved.*only|only.*approved|without consent|risk assessment|required review/i.test(text)) {
    return "restricted";
  }

  if (/required|mandatory|must|shall|need to|needs to|declare|declaration|acknowledg|cite|citation/i.test(text)) {
    return "required";
  }

  if (/conditional|condition|unless|except|permission|authorized|authorised|approved by|instructor|syllabus|course-by-course|case-by-case/i.test(text)) {
    return "conditionally_allowed";
  }

  if (/permitted|allowed|may use|can use|available|provided|licensed|approved/i.test(text)) {
    return "allowed";
  }

  if (/recommend|encourag|guidance|principle|resource|should/i.test(text)) {
    return "recommended";
  }

  return definition.defaultStatus;
}

function deriveNormalizedValue(
  definition: DimensionDefinition,
  status: AnalysisDimensionStatus,
  claims: PolicyClaim[]
): string {
  const explicitValue = claims.find((claim) => claim.claimValue)?.claimValue;
  if (explicitValue) return explicitValue;

  return `${definition.normalizedValue}:${status}`;
}

function buildDimensionSummary(
  entityName: string,
  definition: DimensionDefinition,
  status: AnalysisDimensionStatus,
  claims: PolicyClaim[]
): string {
  return `${entityName} has ${claims.length} source-backed public claim${
    claims.length === 1 ? "" : "s"
  } for ${definition.label.toLowerCase()}; deterministic analysis status: ${status}.`;
}

function buildDimensionExplanation(
  definition: DimensionDefinition,
  status: AnalysisDimensionStatus,
  claims: PolicyClaim[]
): string {
  return (
    `${definition.description} This ${status} status was derived from claim type, normalized value, and keyword rules over ` +
    `${claims.length} supporting public claim${claims.length === 1 ? "" : "s"}. Review the basis array before reusing this as a policy conclusion.`
  );
}

function buildCoverageScore(dimensions: PolicyAnalysisDimension[]) {
  const byKey = new Map(dimensions.map((dimension) => [dimension.key, dimension]));
  const components = COVERAGE_COMPONENTS.map((component) => {
    const dimension = byKey.get(component.key);
    const hasEvidence = Boolean(dimension?.evidenceClaimIds.length);

    return {
      key: component.key,
      label: component.label,
      points: hasEvidence ? component.maxPoints : 0,
      maxPoints: component.maxPoints,
      status: dimension?.status ?? "not_mentioned",
      evidenceClaimIds: dimension?.evidenceClaimIds ?? [],
      reviewState: REVIEW_STATE
    };
  });
  const score = components.reduce((total, component) => total + component.points, 0);

  return {
    score,
    maxScore: 100 as const,
    label: deriveCoverageLabel(score),
    components,
    reviewState: REVIEW_STATE,
    limitations: [
      "Policy Coverage Score measures breadth of public, source-backed coverage; it is not a policy quality score.",
      NO_ADVICE_BOUNDARY
    ]
  };
}

function deriveCoverageLabel(score: number) {
  if (score >= 75) return "broad_public_coverage";
  if (score >= 50) return "moderate_public_coverage";
  if (score >= 25) return "partial_public_coverage";
  return "minimal_public_coverage";
}

function deriveDimensionConfidence(claims: PolicyClaim[]): number {
  if (!claims.length) return 0;
  const average =
    claims.reduce((total, claim) => total + claim.confidence, 0) / claims.length;

  return roundConfidence(average * DEFAULT_CONFIDENCE_PENALTY);
}

function deriveProfileConfidence(dimensions: PolicyAnalysisDimension[]): number {
  const supported = dimensions.filter((dimension) => dimension.evidenceCount > 0);
  if (!supported.length) return 0;
  const average =
    supported.reduce((total, dimension) => total + dimension.confidence, 0) /
    supported.length;

  return roundConfidence(average);
}

function roundConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
}

function normalizeBasisReviewState(
  reviewState: PolicyClaim["reviewState"]
): AnalysisReviewState {
  if (reviewState === "rejected") return "rejected";
  return reviewState;
}

function reviewStateRank(reviewState: PolicyClaim["reviewState"]): number {
  if (reviewState === "human_reviewed") return 4;
  if (reviewState === "agent_reviewed") return 3;
  if (reviewState === "machine_candidate") return 2;
  if (reviewState === "needs_review") return 1;
  return 0;
}

function buildCitation(input: {
  citationTitle: string;
  canonicalUrl: string;
  publicJsonUrl: string;
  suggestedCitation: string;
}): PublicApiCitation {
  return {
    ...input,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT
  };
}

function latestIso(values: Array<string | undefined>): string | undefined {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right)
  );
}

function makeFallbackClaimId(slug: string, claim: PolicyClaim): string {
  return `${slug}:${claim.claimType}:${claim.claimText.slice(0, 32)}`;
}

export const policyAnalysisDimensionDefinitions = policyAnalysisDimensionKeySchema
  .options.map((key) => {
    const definition = DIMENSION_DEFINITIONS.find((item) => item.key === key);
    if (!definition) throw new Error(`Missing analysis dimension definition: ${key}`);

    return {
      key,
      label: definition.label,
      description: definition.description
    };
  });
