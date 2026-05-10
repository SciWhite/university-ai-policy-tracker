import {
  PUBLIC_API_VERSION,
  type CatalogUniversityRanking,
  type ClaimReviewState,
  type RankingSystemId
} from "@uapt/shared";
import { getStagedPublicDataset } from "./staged-public-data";

export type UniversityIndexSortKey =
  | "rank"
  | "recent"
  | "name"
  | "claims"
  | "sources";
export type UniversityIndexSortOrder = "asc" | "desc";
export type UniversityIndexCoverageFilter = "all" | "ranked" | "missing";

export interface UniversityIndexRankingSystem {
  id: RankingSystemId;
  label: string;
}

export interface StaticUniversityIndexRecord {
  claimCount: number;
  confidence?: number;
  country: string;
  lastChangedAt?: string;
  lastCheckedAt?: string;
  name: string;
  publicJsonUrl: string;
  rankings: CatalogUniversityRanking[];
  region: string;
  reviewState?: ClaimReviewState;
  reviewedClaimCount: number;
  slug: string;
  sourceCount: number;
  summary?: string;
}

export const universityIndexRankingSystems: UniversityIndexRankingSystem[] = [
  { id: "qs", label: "QS" },
  { id: "the", label: "THE" },
  { id: "arwu", label: "ARWU" },
  { id: "usnews", label: "U.S. News" },
  { id: "cwts", label: "CWTS Leiden" }
];

export async function getStaticUniversityIndexRecords(): Promise<
  StaticUniversityIndexRecord[]
> {
  const dataset = await getStagedPublicDataset();
  const summariesBySlug = new Map(
    dataset.publicSummaries.map((summary) => [summary.entity.slug, summary])
  );

  return dataset.catalogUniversities
    .map((catalog) => {
      const summary = summariesBySlug.get(catalog.slug);

      return {
        slug: catalog.slug,
        name: catalog.name,
        country: catalog.country,
        region: catalog.region,
        summary: summary?.summary ?? catalog.summary,
        claimCount: summary?.claims.length ?? 0,
        reviewedClaimCount:
          summary?.claims.filter((claim) => isReviewedClaim(claim.reviewState))
            .length ?? 0,
        confidence: summary?.confidence,
        lastCheckedAt:
          summary?.lastCheckedAt ?? latestSourceDate(catalog, "lastCheckedAt"),
        lastChangedAt:
          summary?.lastChangedAt ?? latestSourceDate(catalog, "lastChangedAt"),
        publicJsonUrl:
          summary?.apiUrl ??
          `/api/public/${PUBLIC_API_VERSION}/universities/${catalog.slug}.json`,
        rankings: catalog.rankings,
        reviewState: summary?.reviewState,
        sourceCount:
          summary?.officialSources.length ??
          catalog.sourceCount ??
          catalog.sources.length
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function isReviewedClaim(reviewState: string | undefined): boolean {
  return reviewState === "agent_reviewed" || reviewState === "human_reviewed";
}

function latestSourceDate(
  university: {
    sources: Array<{
      lastCheckedAt?: string;
      lastChangedAt?: string;
    }>;
  },
  key: "lastCheckedAt" | "lastChangedAt"
): string | undefined {
  return university.sources
    .map((source) => source[key])
    .filter((value): value is string => Boolean(value))
    .sort(
      (left, right) => new Date(right).getTime() - new Date(left).getTime()
    )[0];
}
