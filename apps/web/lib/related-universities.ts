import type { CatalogUniversity, PublicEntitySummary } from "@uapt/shared";

/**
 * Deterministic related-university selection for the index-recovery pilot.
 *
 * Selection is limited to real catalog records (link targets always exist)
 * and prefers same-country universities whose reviewed claims share the most
 * claim types with the current record, then higher reviewed-claim counts,
 * then name order. The result is stable for a given dataset snapshot.
 *
 * Related links are navigational only: they never state that the linked
 * university applies the same policy.
 */

export interface RelatedUniversityRef {
  slug: string;
  name: string;
  country: string;
  region?: string;
}

const MIN_REVIEWED_CLAIMS = 2;

interface Candidate extends RelatedUniversityRef {
  reviewedCount: number;
  sharedTypes: number;
  proximity: number;
}

// Small, explicit metropolitan groups; unmatched places keep the same-city rule.
// Country is always checked, so Cambridge UK and Cambridge US never share a group.
const metroAreas: Record<string, string[]> = {
  "United States:boston": [
    "boston",
    "cambridge",
    "medford",
    "waltham",
    "chestnut hill",
  ],
  "United States:bay-area": [
    "stanford",
    "palo alto",
    "berkeley",
    "san francisco",
    "oakland",
    "santa clara",
    "san jose",
  ],
};
function proximity(
  country: string,
  currentCountry: string,
  region: string | undefined,
  currentRegion: string | undefined,
) {
  if (country !== currentCountry || !region || !currentRegion) return 0;
  const city = region.trim().toLowerCase();
  if (city === currentRegion) return 2;
  return Object.entries(metroAreas).some(
    ([key, cities]) =>
      key.startsWith(`${country}:`) &&
      cities.includes(city) &&
      cities.includes(currentRegion),
  )
    ? 1
    : 0;
}

export function selectRelatedUniversities(
  currentSlug: string,
  catalogUniversities: CatalogUniversity[],
  publicSummaries: PublicEntitySummary[],
  limit = 5,
  preferGeography = false,
): RelatedUniversityRef[] {
  const reviewedTypesBySlug = new Map<
    string,
    { count: number; types: Set<string> }
  >();
  for (const summary of publicSummaries) {
    const reviewed = summary.claims.filter(
      (claim) =>
        claim.reviewState === "agent_reviewed" ||
        claim.reviewState === "human_reviewed",
    );
    reviewedTypesBySlug.set(summary.entity.slug, {
      count: reviewed.length,
      types: new Set(reviewed.map((claim) => claim.claimType)),
    });
  }

  const current = reviewedTypesBySlug.get(currentSlug);
  const currentCountry = catalogUniversities.find(
    (university) => university.slug === currentSlug,
  )?.country;
  const currentRegion = catalogUniversities
    .find((u) => u.slug === currentSlug)
    ?.region?.trim()
    .toLowerCase();
  if (!current || !currentCountry) return [];

  const candidates: Candidate[] = [];
  for (const university of catalogUniversities) {
    if (university.slug === currentSlug) continue;
    const reviewed = reviewedTypesBySlug.get(university.slug);
    if (!reviewed || reviewed.count < MIN_REVIEWED_CLAIMS) continue;

    candidates.push({
      slug: university.slug,
      name: university.name,
      country: university.country,
      region: university.region,
      proximity: proximity(
        university.country,
        currentCountry,
        university.region,
        currentRegion,
      ),
      reviewedCount: reviewed.count,
      sharedTypes: [...current.types].filter((type) => reviewed.types.has(type))
        .length,
    });
  }

  const byTopicThenName = (left: Candidate, right: Candidate): number =>
    (preferGeography ? right.proximity - left.proximity : 0) ||
    right.sharedTypes - left.sharedTypes ||
    right.reviewedCount - left.reviewedCount ||
    left.name.localeCompare(right.name);

  const selected = [
    ...candidates
      .filter((candidate) => candidate.country === currentCountry)
      .sort(byTopicThenName),
    ...candidates
      .filter((candidate) => candidate.country !== currentCountry)
      .sort(byTopicThenName),
  ].slice(0, Math.max(1, limit));

  return selected.map(({ slug, name, country, region }) => ({
    slug,
    name,
    country,
    ...(preferGeography && region ? { region } : {}),
  }));
}
