import type {
  AnalysisDimensionStatus,
  PolicyAnalysisDimension,
  PolicyAnalysisDimensionKey,
  PolicyAnalysisProfile
} from "@uapt/shared";
import {
  getPolicyAnalysisDimensionLabel,
  getPolicyAnalysisProfiles
} from "./policy-analysis";

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
