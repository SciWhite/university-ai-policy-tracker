import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  type CatalogUniversityRanking,
  type PolicyClaim,
  type PublicEntitySummary,
  type RankingSystemId
} from "@uapt/shared";
import {
  getStaticUniversityIndexRecords,
  type StaticUniversityIndexRecord
} from "./university-index-records";
import { getStagedPublicDataset } from "./staged-public-data";

export interface PublicReferenceRecord extends StaticUniversityIndexRecord {
  summaryRecord?: PublicEntitySummary;
}

export interface RankingLandingSpec {
  caveat: string;
  description: string;
  label: string;
  rankTypeNote: string;
  slug: string;
  sourceRole: string;
  systemId: RankingSystemId;
  title: string;
  yearLabel: string;
}

export interface RegionLandingSpec {
  countries: string[];
  description: string;
  label: string;
  slug: string;
  title: string;
}

export interface ThemeLandingSpec {
  description: string;
  label: string;
  slug: string;
  title: string;
}

export interface ThemeRecord {
  claims: PolicyClaim[];
  record: PublicReferenceRecord;
}

export const rankingLandingSpecs: RankingLandingSpec[] = [
  {
    slug: "qs-2026",
    systemId: "qs",
    label: "QS 2026",
    title: "QS 2026 indexed university policy records",
    yearLabel: "2026",
    sourceRole:
      "QS 2026 currently remains the main crawl batching source for tracker coverage expansion.",
    rankTypeNote: "Official ordinal ranking rows are used as an index source.",
    caveat:
      "QS 2026 coverage is a crawl batching and filtering surface here, not a tracker-created policy ranking.",
    description:
      "Public university AI policy records that match the QS World University Rankings 2026 index."
  },
  {
    slug: "the-2026",
    systemId: "the",
    label: "THE 2026",
    title: "THE 2026 indexed university policy records",
    yearLabel: "2026",
    sourceRole:
      "THE 2026 is supported as a ranking index and filter source.",
    rankTypeNote: "Official ordinal ranking rows are used as an index source.",
    caveat:
      "THE 2026 rows are not merged into a unified 2026 ranking with QS, ARWU, U.S. News, or CWTS.",
    description:
      "Public university AI policy records that match the Times Higher Education 2026 index."
  },
  {
    slug: "arwu-2025",
    systemId: "arwu",
    label: "ARWU 2025",
    title: "ARWU 2025 indexed university policy records",
    yearLabel: "2025",
    sourceRole:
      "ARWU 2025 is supported as a ranking index and filter source.",
    rankTypeNote: "Official ordinal ranking rows are used as an index source.",
    caveat:
      "ARWU 2025 remains a separate source year and is not presented as a 2026 ranking.",
    description:
      "Public university AI policy records that match the Academic Ranking of World Universities 2025 index."
  },
  {
    slug: "usnews-2025-2026",
    systemId: "usnews",
    label: "U.S. News 2025-2026",
    title: "U.S. News 2025-2026 indexed university policy records",
    yearLabel: "2025-2026",
    sourceRole:
      "U.S. News 2025-2026 is supported as a ranking index and filter source.",
    rankTypeNote: "Official ordinal ranking rows are used as an index source.",
    caveat:
      "U.S. News 2025-2026 is kept as its own source period and is not normalized into a single 2026 ranking.",
    description:
      "Public university AI policy records that match the U.S. News Best Global Universities 2025-2026 index."
  },
  {
    slug: "cwts-leiden-2025",
    systemId: "cwts",
    label: "CWTS Leiden 2025",
    title: "CWTS Leiden 2025 indexed university policy records",
    yearLabel: "2025",
    sourceRole:
      "CWTS Leiden 2025 is supported as an index and filter source.",
    rankTypeNote:
      "CWTS rows are a derived metric order, not an overall global university rank.",
    caveat:
      "CWTS Leiden 2025 must not be described as an overall global university ranking or merged into a unified 2026 ranking.",
    description:
      "Public university AI policy records that match the CWTS Leiden 2025 derived metric order."
  }
];

export const regionLandingSpecs: RegionLandingSpec[] = [
  {
    slug: "united-states",
    label: "United States",
    title: "United States university AI policy records",
    countries: ["United States", "United States of America", "USA", "U.S."],
    description:
      "Public source-backed AI policy records for universities in the United States."
  },
  {
    slug: "united-kingdom",
    label: "United Kingdom",
    title: "United Kingdom university AI policy records",
    countries: ["United Kingdom", "UK", "U.K.", "England", "Scotland", "Wales"],
    description:
      "Public source-backed AI policy records for universities in the United Kingdom."
  }
];

export const themeLandingSpecs: ThemeLandingSpec[] = [
  {
    slug: "ai-disclosure",
    label: "AI disclosure",
    title: "Which universities mention AI disclosure?",
    description:
      "Published claim records where the visible claim or original evidence mentions disclosure, declaration, citation, attribution, transparency, or assignment-level permission."
  },
  {
    slug: "approved-ai-tools",
    label: "Approved AI tools",
    title: "Which universities mention approved AI tools?",
    description:
      "Published claim records where the visible claim or original evidence concerns named AI tools, licensed services, approved tools, procurement, or security review."
  },
  {
    slug: "chatgpt-coursework-policy",
    label: "ChatGPT coursework",
    title: "Which universities mention ChatGPT or AI in coursework?",
    description:
      "Published claim records where the visible claim or original evidence mentions ChatGPT, OpenAI, GPT, coursework, assignments, syllabi, teaching, classroom use, or assessment context."
  },
  {
    slug: "ai-in-exams",
    label: "AI in exams",
    title: "Which universities mention AI in exams or assessments?",
    description:
      "Published claim records where the visible claim or original evidence mentions exams, tests, quizzes, proctoring, assessment rules, or assessment-related AI restrictions."
  },
  {
    slug: "ai-detectors",
    label: "AI detectors",
    title: "Which universities mention AI detection or detector tools?",
    description:
      "Published claim records where the visible claim or original evidence mentions AI detection, detector tools, originality checks, Turnitin, plagiarism detection, or AI-generated text checks."
  },
  {
    slug: "privacy-data-entry",
    label: "Privacy and data entry",
    title: "Which universities mention AI privacy or data-entry rules?",
    description:
      "Published claim records where the visible claim or original evidence mentions privacy, personal data, confidential information, sensitive data, data entry, FERPA, GDPR, security, or information-protection rules."
  }
];

export const publicJsonPaths = {
  index: `/api/public/${PUBLIC_API_VERSION}/index.json`,
  universities: `/api/public/${PUBLIC_API_VERSION}/universities.json`
} as const;

export const referencePageCaveats = [
  "Public pages and public JSON should remain consistent because both are built from the promoted public release dataset.",
  "Original-language evidence is canonical. Translations and display summaries are auxiliary.",
  "Confidence is separate from reviewState; reviewState describes workflow status.",
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  NO_ADVICE_BOUNDARY
] as const;

export async function getPublicReferenceRecords(): Promise<
  PublicReferenceRecord[]
> {
  const [records, dataset] = await Promise.all([
    getStaticUniversityIndexRecords(),
    getStagedPublicDataset()
  ]);
  const summariesBySlug = new Map(
    dataset.publicSummaries.map((summary) => [summary.entity.slug, summary])
  );

  return records.map((record) => ({
    ...record,
    summaryRecord: summariesBySlug.get(record.slug)
  }));
}

export function getRankingLandingSpec(
  slug: string
): RankingLandingSpec | undefined {
  return rankingLandingSpecs.find((spec) => spec.slug === slug);
}

export function getRegionLandingSpec(
  slug: string
): RegionLandingSpec | undefined {
  return regionLandingSpecs.find((spec) => spec.slug === slug);
}

export function getThemeLandingSpec(
  slug: string
): ThemeLandingSpec | undefined {
  return themeLandingSpecs.find((spec) => spec.slug === slug);
}

export function getSelectedRanking(
  record: PublicReferenceRecord,
  systemId: RankingSystemId
): CatalogUniversityRanking | undefined {
  return record.rankings.find((ranking) => ranking.systemId === systemId);
}

export function getThemeRecords(
  records: PublicReferenceRecord[],
  slug: string
): ThemeRecord[] {
  return records
    .map((record) => {
      const claims =
        record.summaryRecord?.claims.filter((claim) =>
          matchesThemeClaim(claim, slug)
        ) ?? [];

      return { record, claims };
    })
    .filter((item) => item.claims.length > 0)
    .sort((left, right) => {
      const claimDelta = right.claims.length - left.claims.length;
      if (claimDelta !== 0) return claimDelta;

      return left.record.name.localeCompare(right.record.name);
    });
}

export function buildThemeCitationReadySummary(
  spec: ThemeLandingSpec,
  records: ThemeRecord[],
  claimCount: number,
  evidenceCount: number,
  sourceCount: number
): string {
  return `University AI Policy Tracker currently indexes ${records.length} public university record${records.length === 1 ? "" : "s"} with ${claimCount} source-backed claim${claimCount === 1 ? "" : "s"} related to ${spec.label.toLowerCase()}, supported by ${evidenceCount} evidence record${evidenceCount === 1 ? "" : "s"} and ${sourceCount} official source attribution${sourceCount === 1 ? "" : "s"}. This page is a public dataset slice generated from promoted claim/evidence records; it does not create new policy conclusions. Original-language evidence remains canonical, and each linked university record exposes review state, confidence, source URLs, snapshot hashes, and public JSON.`;
}

export function countReviewedClaims(record: PublicReferenceRecord): number {
  return (
    record.summaryRecord?.claims.filter((claim) =>
      isReviewedClaim(claim.reviewState)
    ).length ?? record.reviewedClaimCount
  );
}

export function countCandidateClaims(record: PublicReferenceRecord): number {
  return Math.max(record.claimCount - countReviewedClaims(record), 0);
}

export function formatDate(value: string | undefined, locale = "en"): string {
  if (!value) return "Not published";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}

export function formatClaimType(value: string): string {
  const labels: Record<string, string> = {
    ai_tool_treatment: "AI tool treatment",
    academic_integrity: "Academic integrity",
    privacy: "Privacy",
    teaching: "Teaching",
    research: "Research",
    security_review: "Security review",
    procurement: "Procurement",
    source_status: "Source status",
    other: "Other"
  };

  if (labels[value]) return labels[value];
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isReviewedClaim(reviewState: string | undefined): boolean {
  return reviewState === "agent_reviewed" || reviewState === "human_reviewed";
}

function matchesThemeClaim(claim: PolicyClaim, slug: string): boolean {
  const haystack = [
    claim.claimType,
    claim.claimText,
    claim.claimValue,
    ...claim.evidence.flatMap((evidence) => [
      evidence.evidenceSnippet,
      evidence.evidenceSnippetDisplay,
      evidence.attribution.citationTitle
    ])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (slug === "ai-disclosure") {
    return [
      "disclos",
      "declar",
      "citation",
      "cite",
      "attribution",
      "transparen",
      "acknowledg",
      "assignment",
      "course"
    ].some((keyword) => haystack.includes(keyword));
  }

  if (slug === "approved-ai-tools") {
    return (
      claim.claimType === "ai_tool_treatment" ||
      claim.claimType === "procurement" ||
      claim.claimType === "security_review" ||
      [
        "approved",
        "licensed",
        "tool",
        "copilot",
        "chatgpt",
        "gemini",
        "service",
        "procurement",
        "security review"
      ].some((keyword) => haystack.includes(keyword))
    );
  }

  if (slug === "chatgpt-coursework-policy") {
    return [
      "chatgpt",
      "openai",
      "gpt",
      "coursework",
      "assignment",
      "homework",
      "syllabus",
      "course",
      "classroom",
      "teaching",
      "assessment"
    ].some((keyword) => haystack.includes(keyword));
  }

  if (slug === "ai-in-exams") {
    return [
      "exam",
      "test",
      "quiz",
      "assessment",
      "proctor",
      "invigil",
      "take-home"
    ].some((keyword) => haystack.includes(keyword));
  }

  if (slug === "ai-detectors") {
    return [
      "detector",
      "detection",
      "turnitin",
      "originality",
      "plagiarism",
      "ai-generated",
      "ai generated"
    ].some((keyword) => haystack.includes(keyword));
  }

  if (slug === "privacy-data-entry") {
    return (
      claim.claimType === "privacy" ||
      claim.claimType === "security_review" ||
      [
        "privacy",
        "personal data",
        "confidential",
        "sensitive",
        "data entry",
        "ferpa",
        "gdpr",
        "security",
        "information protection"
      ].some((keyword) => haystack.includes(keyword))
    );
  }

  return false;
}
