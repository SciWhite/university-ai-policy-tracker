import { getStagedPublicDataset } from "./staged-public-data";
import { getDiscoveryTopicKeys } from "./discovery-topic-groups";
import { getStaticUniversityIndexRecords } from "./university-index-records";
import { rankingLandingSpecs } from "./reference-pages";
export async function getRankingsDirectoryData() {
  const [records, dataset] = await Promise.all([
    getStaticUniversityIndexRecords(),
    getStagedPublicDataset(),
  ]);
  const topicMap = new Map(
    dataset.publicSummaries.map((r) => [
      r.entity.slug,
      [...new Set(r.claims.flatMap(getDiscoveryTopicKeys))],
    ]),
  );
  return rankingLandingSpecs.map((spec) => {
    const rows = records
      .flatMap((record) => {
        const rank = record.rankings.find((r) => r.systemId === spec.systemId);
        return rank
          ? [
              {
                slug: record.slug,
                topics: topicMap.get(record.slug) ?? [],
                name: record.name,
                country: record.country,
                region: record.region,
                lastCheckedAt: record.lastCheckedAt,
                reviewedClaimCount: record.reviewedClaimCount,
                claimCount: record.claimCount,
                sourceCount: record.sourceCount,
                rankText: rank.rankText,
                rankNumber: rank.rankNumber,
                rankType: rank.rankType,
                rankingYear: rank.rankingYear,
              },
            ]
          : [];
      })
      .sort(
        (a, b) =>
          (a.rankNumber ?? Infinity) - (b.rankNumber ?? Infinity) ||
          a.name.localeCompare(b.name),
      );
    return {
      spec,
      rows,
      reviewedCount: rows.filter((r) => r.reviewedClaimCount > 0).length,
    };
  });
}
export type RankingViewRow = Awaited<
  ReturnType<typeof getRankingsDirectoryData>
>[number]["rows"][number];
