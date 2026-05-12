import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  POLICY_ANALYSIS_PAGE_QUALITY_SCHEMA_VERSION,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE,
  policyAnalysisPageQualityResponseSchema,
  type AnalysisDimensionStatus,
  type AnalysisPageQualityCheck,
  type AnalysisReviewState,
  type PolicyAnalysisDimension,
  type PolicyAnalysisDimensionKey,
  type PolicyAnalysisPageQualityItem,
  type PolicyAnalysisPageQualityResponse,
  type PolicyAnalysisProfile,
  type PolicyAnalysisReviewWorkflow
} from "@uapt/shared";
import {
  getPolicyAnalysisDimensionLabel,
  getPolicyAnalysisProfiles
} from "./policy-analysis";
import { getSiteBaseUrl } from "./site-url";

export const analysisThemeSpecs = [
  {
    slug: "disclosure",
    key: "ai_disclosure",
    label: "AI disclosure",
    title: "University AI Disclosure Policy Analysis",
    description:
      "Source-backed analysis of public university guidance on disclosing, acknowledging, citing, or declaring AI use.",
    summaryLabel: "AI disclosure guidance"
  },
  {
    slug: "privacy",
    key: "privacy_data_entry",
    label: "Privacy and data entry",
    title: "University AI Privacy and Data Entry Policy Analysis",
    description:
      "Source-backed analysis of public university guidance on personal, confidential, sensitive, regulated, or student data entry into AI tools.",
    summaryLabel: "privacy and data-entry guidance"
  },
  {
    slug: "approved-tools",
    key: "approved_tools",
    label: "Approved AI tools",
    title: "University Approved AI Tools Policy Analysis",
    description:
      "Source-backed analysis of public university guidance naming approved, licensed, procured, or enterprise AI tools.",
    summaryLabel: "approved or licensed AI tool guidance"
  }
] as const satisfies ReadonlyArray<{
  slug: string;
  key: PolicyAnalysisDimensionKey;
  label: string;
  title: string;
  description: string;
  summaryLabel: string;
}>;

export interface AnalysisThemeRow {
  profile: PolicyAnalysisProfile;
  dimension: PolicyAnalysisDimension;
}

export interface AnalysisThemeSummary {
  spec: (typeof analysisThemeSpecs)[number];
  rows: AnalysisThemeRow[];
  evidenceBackedCount: number;
  statusCounts: Array<{
    status: AnalysisDimensionStatus;
    count: number;
  }>;
}

const ANALYSIS_PAGE_QUALITY_LIMITATIONS = [
  "Analysis page quality checks validate public-page publication readiness, not the truth or legal adequacy of any university policy.",
  "Passing a page-quality gate does not change analysis review state. Machine-candidate analysis remains machine_candidate until reviewed.",
  NO_ADVICE_BOUNDARY
];

export const analysisPageQualityGates = [
  {
    gateId: "server_rendered_public_content",
    label: "Server-rendered public content",
    requirement:
      "Analysis conclusions, caveats, review state, evidence counts, and public JSON links must be visible in HTML."
  },
  {
    gateId: "theme_evidence_threshold",
    label: "Theme evidence threshold",
    requirement:
      "Theme analysis pages are generated only when at least five records have source-backed evidence for the dimension."
  },
  {
    gateId: "review_state_boundary",
    label: "Review state boundary",
    requirement:
      "Review state must be visible and must remain separate from confidence."
  },
  {
    gateId: "original_language_evidence",
    label: "Original-language evidence",
    requirement:
      "Source-language evidence remains canonical; localized display cannot replace it."
  },
  {
    gateId: "coverage_score_caveat",
    label: "Coverage score caveat",
    requirement:
      "Coverage scores must be described only as breadth of public source-backed coverage, not quality, compliance, legality, safety, or ranking."
  },
  {
    gateId: "no_advice_boundary",
    label: "No-advice boundary",
    requirement:
      "Pages must state that tracker analysis is not legal advice, academic integrity advice, or an official university statement."
  },
  {
    gateId: "versioned_public_json",
    label: "Versioned public JSON",
    requirement:
      "Public analysis metadata must use /api/public/v1/... endpoints."
  }
] as const;

export const analysisReviewChecklist = [
  "Confirm every non-empty analysis dimension links to public claim IDs and source URLs.",
  "Confirm not_mentioned means absence of current tracker evidence, not permission, prohibition, or proof that no policy exists.",
  "Confirm original-language evidence and source language are retained in the basis records.",
  "Confirm confidence remains secondary to review state.",
  "Confirm coverage-score text avoids quality, safety, compliance, legal adequacy, or ranking language.",
  "Confirm public JSON URLs are versioned under /api/public/v1/.",
  "Confirm the page includes no legal advice and no academic integrity advice."
] as const;

export function getAnalysisThemeSpec(slug: string) {
  return analysisThemeSpecs.find((spec) => spec.slug === slug);
}

export async function getAnalysisThemeSummary(
  slug: string
): Promise<AnalysisThemeSummary | undefined> {
  const spec = getAnalysisThemeSpec(slug);
  if (!spec) return undefined;

  const profiles = await getPolicyAnalysisProfiles();
  const rows = profiles
    .map((profile) => {
      const dimension = profile.dimensions.find(
        (item) => item.key === spec.key
      );

      return dimension ? { profile, dimension } : undefined;
    })
    .filter((row): row is AnalysisThemeRow => Boolean(row))
    .sort(compareThemeRows);
  const statusCounts = countStatuses(rows.map((row) => row.dimension.status));

  return {
    spec,
    rows,
    evidenceBackedCount: rows.filter((row) => row.dimension.evidenceCount > 0)
      .length,
    statusCounts
  };
}

export async function getPublishableAnalysisThemeSpecs() {
  const summaries = await Promise.all(
    analysisThemeSpecs.map((spec) => getAnalysisThemeSummary(spec.slug))
  );

  return summaries
    .filter(
      (summary): summary is AnalysisThemeSummary =>
        summary !== undefined && summary.evidenceBackedCount >= 5
    )
    .map((summary) => summary.spec);
}

export function getCoverageRows(profiles: PolicyAnalysisProfile[]) {
  return [...profiles].sort((left, right) => {
    const scoreDelta = right.coverageScore.score - left.coverageScore.score;
    if (scoreDelta !== 0) return scoreDelta;

    const evidenceDelta =
      right.basedOnClaimIds.length - left.basedOnClaimIds.length;
    if (evidenceDelta !== 0) return evidenceDelta;

    return left.entityName.localeCompare(right.entityName);
  });
}

export function getDimensionCoverageSummary(profiles: PolicyAnalysisProfile[]) {
  const rows = profiles.flatMap((profile) =>
    profile.dimensions.map((dimension) => ({
      profile,
      dimension
    }))
  );
  const dimensionKeys = Array.from(
    new Set(rows.map((row) => row.dimension.key))
  ).sort((left, right) =>
    getPolicyAnalysisDimensionLabel(left).localeCompare(
      getPolicyAnalysisDimensionLabel(right)
    )
  );

  return dimensionKeys.map((key) => {
    const matchingRows = rows.filter((row) => row.dimension.key === key);
    const evidenceBackedCount = matchingRows.filter(
      (row) => row.dimension.evidenceCount > 0
    ).length;

    return {
      key,
      label: getPolicyAnalysisDimensionLabel(key),
      evidenceBackedCount,
      notMentionedCount: matchingRows.filter(
        (row) => row.dimension.status === "not_mentioned"
      ).length,
      statusCounts: countStatuses(
        matchingRows.map((row) => row.dimension.status)
      )
    };
  });
}

export function buildAnalysisCitationReadySummary(input: {
  label: string;
  profileCount: number;
  evidenceBackedCount: number;
  statusCounts: Array<{ status: AnalysisDimensionStatus; count: number }>;
}): string {
  const leadingStatus = input.statusCounts[0];
  const leadingText = leadingStatus
    ? `${leadingStatus.count} records are classified as ${leadingStatus.status}`
    : "no status bucket dominates the current records";

  return (
    `As of the current public release, University AI Policy Tracker has deterministic ${input.label} analysis for ${input.profileCount} university records. ` +
    `${input.evidenceBackedCount} records have source-backed evidence for this dimension; ${leadingText}. ` +
    "These analysis profiles are machine-candidate derived metadata and should be cited with their source claim IDs and public JSON."
  );
}

export function formatCoverageScore(score: number): string {
  return `${score}/100`;
}

export function getAnalysisPageQualityApiPath(): string {
  return `/api/public/${PUBLIC_API_VERSION}/analysis/page-quality.json`;
}

export function buildAnalysisReviewWorkflow(): PolicyAnalysisReviewWorkflow {
  const siteBaseUrl = getSiteBaseUrl();

  return {
    canonicalUrl: new URL("/review#analysis-review", siteBaseUrl).toString(),
    publicJsonUrl: new URL(getAnalysisPageQualityApiPath(), siteBaseUrl).toString(),
    reviewQueue: "analysis_profile_review",
    publicApiMutationAllowed: false,
    reviewStates: [
      "machine_candidate",
      "agent_reviewed",
      "human_reviewed",
      "institution_verified",
      "needs_review",
      "rejected"
    ],
    publicationGate:
      "Analysis profiles remain machine_candidate until reviewers confirm evidence binding, not-mentioned reasoning, source-language preservation, page quality gates, and no-advice boundaries.",
    reviewerChecklist: [...analysisReviewChecklist]
  };
}

export async function buildPolicyAnalysisPageQualityResponse(
  generatedAt = new Date().toISOString()
): Promise<PolicyAnalysisPageQualityResponse> {
  const siteBaseUrl = getSiteBaseUrl();
  const canonicalUrl = new URL("/analysis", siteBaseUrl).toString();
  const publicJsonUrl = new URL(
    getAnalysisPageQualityApiPath(),
    siteBaseUrl
  ).toString();
  const data = await buildAnalysisPageQualityData();

  return policyAnalysisPageQualityResponseSchema.parse({
    apiVersion: PUBLIC_API_VERSION,
    generatedAt,
    canonicalUrl,
    license: TRACKER_METADATA_LICENSE,
    trackerMetadataLicense: TRACKER_METADATA_LICENSE,
    sourcePolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT,
    limitations: ANALYSIS_PAGE_QUALITY_LIMITATIONS,
    citation: {
      citationTitle: "University AI Policy Tracker analysis page quality report",
      canonicalUrl,
      publicJsonUrl,
      suggestedCitation:
        "University AI Policy Tracker analysis page quality report. University AI Policy Tracker. Version v1. " +
        canonicalUrl,
      sourceRightsPolicy: OFFICIAL_SOURCE_RIGHTS_CAVEAT
    },
    data
  });
}

async function buildAnalysisPageQualityData() {
  const profiles = await getPolicyAnalysisProfiles();
  const themeSummaries = (
    await Promise.all(
      (await getPublishableAnalysisThemeSpecs()).map((spec) =>
        getAnalysisThemeSummary(spec.slug)
      )
    )
  ).filter((summary): summary is AnalysisThemeSummary => Boolean(summary));
  const pages = [
    buildAnalysisIndexQualityItem(profiles),
    buildCoverageQualityItem(profiles),
    ...themeSummaries.map(buildThemeQualityItem)
  ];
  const failed = pages.some((page) =>
    page.checks.some((check) => check.status === "fail")
  );
  const warned = pages.some((page) =>
    page.checks.some((check) => check.status === "warning")
  );

  return {
    schemaVersion: POLICY_ANALYSIS_PAGE_QUALITY_SCHEMA_VERSION,
    apiVersion: PUBLIC_API_VERSION,
    status: failed
      ? "fails_quality_gate"
      : warned
        ? "needs_attention"
        : "passes_current_quality_gate",
    generatedFor: "analysis_page_publication",
    qualityGates: [...analysisPageQualityGates],
    pages,
    reviewWorkflow: buildAnalysisReviewWorkflow(),
    limitations: ANALYSIS_PAGE_QUALITY_LIMITATIONS
  };
}

function buildAnalysisIndexQualityItem(
  profiles: PolicyAnalysisProfile[]
): PolicyAnalysisPageQualityItem {
  const evidenceBackedDimensionCount = countEvidenceBackedDimensions(profiles);
  const sourceLanguageCount = countSourceLanguages(profiles);
  const apiPath = `/api/public/${PUBLIC_API_VERSION}/analysis/index.json`;
  const checks: AnalysisPageQualityCheck[] = [
    passFailCheck(
      "minimum_profile_count",
      "Minimum profile count",
      profiles.length >= 20,
      `${profiles.length} analysis profiles are available.`
    ),
    passFailCheck(
      "evidence_backed_dimensions",
      "Evidence-backed dimensions",
      evidenceBackedDimensionCount >= profiles.length,
      `${evidenceBackedDimensionCount} dimensions have source-backed evidence.`
    ),
    passFailCheck(
      "source_languages_preserved",
      "Source languages preserved",
      sourceLanguageCount > 0,
      `${sourceLanguageCount} source language bucket${
        sourceLanguageCount === 1 ? "" : "s"
      } preserved in analysis profiles.`
    ),
    passCheck(
      "visible_boundaries",
      "Visible reuse boundaries",
      "The analysis index states review-state, confidence, original-language evidence, no-advice, and coverage-score caveats."
    ),
    passCheck(
      "versioned_public_json",
      "Versioned public JSON",
      `${apiPath} is versioned under /api/public/v1/.`
    )
  ];

  return qualityItem({
    path: "/analysis",
    pageType: "analysis_index",
    title: "Policy analysis index",
    profileCount: profiles.length,
    evidenceBackedDimensionCount,
    sourceLanguageCount,
    publicJsonUrls: [apiPath],
    checks
  });
}

function buildCoverageQualityItem(
  profiles: PolicyAnalysisProfile[]
): PolicyAnalysisPageQualityItem {
  const evidenceBackedDimensionCount = countEvidenceBackedDimensions(profiles);
  const sourceLanguageCount = countSourceLanguages(profiles);
  const apiPath = `/api/public/${PUBLIC_API_VERSION}/analysis/coverage-scores.json`;
  const allScoresHaveCaveats = profiles.every((profile) =>
    profile.coverageScore.limitations.some((limitation) =>
      limitation.includes("not a policy quality score")
    )
  );
  const checks: AnalysisPageQualityCheck[] = [
    passFailCheck(
      "minimum_profile_count",
      "Minimum profile count",
      profiles.length >= 20,
      `${profiles.length} profiles are present in the coverage table.`
    ),
    passFailCheck(
      "coverage_caveats_present",
      "Coverage caveats present",
      allScoresHaveCaveats,
      "Each profile coverage score carries the not-a-quality-score caveat."
    ),
    passCheck(
      "review_state_visible",
      "Review state visible",
      "The coverage table renders review state for every profile."
    ),
    passCheck(
      "versioned_public_json",
      "Versioned public JSON",
      `${apiPath} is versioned under /api/public/v1/.`
    )
  ];

  return qualityItem({
    path: "/analysis/policy-coverage",
    pageType: "coverage_table",
    title: "Policy coverage score table",
    profileCount: profiles.length,
    evidenceBackedDimensionCount,
    sourceLanguageCount,
    publicJsonUrls: [apiPath],
    checks
  });
}

function buildThemeQualityItem(
  summary: AnalysisThemeSummary
): PolicyAnalysisPageQualityItem {
  const sourceLanguageCount = new Set(
    summary.rows.flatMap((row) => row.dimension.sourceLanguages)
  ).size;
  const checks: AnalysisPageQualityCheck[] = [
    passFailCheck(
      "theme_evidence_threshold",
      "Theme evidence threshold",
      summary.evidenceBackedCount >= 5,
      `${summary.evidenceBackedCount} records have source-backed evidence for ${summary.spec.label}.`
    ),
    passFailCheck(
      "basis_records_present",
      "Basis records present",
      summary.rows
        .filter((row) => row.dimension.evidenceCount > 0)
        .every((row) => row.dimension.basis.length > 0),
      "Evidence-backed rows include basis claim IDs, source URLs, source language, and snippets."
    ),
    passCheck(
      "not_mentioned_boundary",
      "Not-mentioned boundary",
      "`not_mentioned` is described as absence of current tracker evidence, not as permission or prohibition."
    ),
    passCheck(
      "review_state_visible",
      "Review state visible",
      "Theme rows render review state next to analysis status."
    ),
    passCheck(
      "versioned_public_json",
      "Versioned public JSON",
      "Theme rows link to versioned per-university analysis JSON."
    )
  ];

  return qualityItem({
    path: `/analysis/${summary.spec.slug}`,
    pageType: "theme_analysis",
    title: summary.spec.title,
    profileCount: summary.rows.length,
    evidenceBackedDimensionCount: summary.evidenceBackedCount,
    sourceLanguageCount,
    publicJsonUrls: uniqueStrings(
      summary.rows.map((row) => row.profile.publicJsonUrl)
    ),
    checks
  });
}

function qualityItem(input: {
  path: string;
  pageType: PolicyAnalysisPageQualityItem["pageType"];
  title: string;
  profileCount: number;
  evidenceBackedDimensionCount: number;
  sourceLanguageCount: number;
  publicJsonUrls: string[];
  checks: AnalysisPageQualityCheck[];
}): PolicyAnalysisPageQualityItem {
  return {
    ...input,
    canonicalUrl: new URL(input.path, getSiteBaseUrl()).toString(),
    reviewState: derivePageReviewState(input.checks),
    indexable: input.checks.every((check) => check.status === "pass"),
    publicJsonUrls: input.publicJsonUrls.map((pathOrUrl) =>
      pathOrUrl.startsWith("http")
        ? pathOrUrl
        : new URL(pathOrUrl, getSiteBaseUrl()).toString()
    ),
    limitations: ANALYSIS_PAGE_QUALITY_LIMITATIONS
  };
}

function derivePageReviewState(
  checks: AnalysisPageQualityCheck[]
): AnalysisReviewState {
  if (checks.some((check) => check.status === "fail")) return "needs_review";

  return "machine_candidate";
}

function passCheck(
  checkId: string,
  label: string,
  summary: string
): AnalysisPageQualityCheck {
  return { checkId, label, status: "pass", summary };
}

function passFailCheck(
  checkId: string,
  label: string,
  passed: boolean,
  summary: string
): AnalysisPageQualityCheck {
  return { checkId, label, status: passed ? "pass" : "fail", summary };
}

function countEvidenceBackedDimensions(
  profiles: PolicyAnalysisProfile[]
): number {
  return profiles.reduce(
    (total, profile) =>
      total +
      profile.dimensions.filter((dimension) => dimension.evidenceCount > 0)
        .length,
    0
  );
}

function countSourceLanguages(profiles: PolicyAnalysisProfile[]): number {
  return new Set(profiles.flatMap((profile) => profile.sourceLanguages)).size;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right)
  );
}

function compareThemeRows(left: AnalysisThemeRow, right: AnalysisThemeRow): number {
  const evidenceDelta =
    right.dimension.evidenceCount - left.dimension.evidenceCount;
  if (evidenceDelta !== 0) return evidenceDelta;

  const statusDelta =
    statusRank(right.dimension.status) - statusRank(left.dimension.status);
  if (statusDelta !== 0) return statusDelta;

  return left.profile.entityName.localeCompare(right.profile.entityName);
}

function statusRank(status: AnalysisDimensionStatus): number {
  if (status === "required") return 8;
  if (status === "restricted") return 7;
  if (status === "blocked") return 6;
  if (status === "conditionally_allowed") return 5;
  if (status === "allowed") return 4;
  if (status === "recommended") return 3;
  if (status === "unclear") return 2;
  if (status === "insufficient_public_evidence") return 1;
  return 0;
}

function countStatuses(statuses: AnalysisDimensionStatus[]) {
  const counts = new Map<AnalysisDimensionStatus, number>();
  for (const status of statuses) {
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((left, right) => {
      const countDelta = right.count - left.count;
      if (countDelta !== 0) return countDelta;

      return statusRank(right.status) - statusRank(left.status);
    });
}
