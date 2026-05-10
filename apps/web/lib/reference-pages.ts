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
    title: "AI disclosure policy claim records",
    description:
      "Published claim records where the visible claim or original evidence mentions disclosure, declaration, citation, attribution, transparency, or assignment-level permission."
  },
  {
    slug: "approved-ai-tools",
    label: "Approved AI tools",
    title: "Approved AI tools policy claim records",
    description:
      "Published claim records where the visible claim or original evidence concerns named AI tools, licensed services, approved tools, procurement, or security review."
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

export function formatDate(value: string | undefined): string {
  if (!value) return "Not published";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}

export function formatClaimType(value: string): string {
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

  return false;
}
