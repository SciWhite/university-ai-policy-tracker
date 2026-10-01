import { hasCurrentIndexRecoveryBasis, reviewedClaimsFingerprint } from "@/lib/index-recovery-basis";
import { getLoadedPolicySnapshotBySlug } from "@/lib/policy-snapshots";
import { isStrongStudentSnapshot } from "@/components/student-policy-snapshot";
import { getStagedPublicSummaryBySlug } from "@/lib/staged-public-data";
import type { PolicyClaim } from "@uapt/shared";

/** Pinned claim fingerprint for Stanford's independent illustration basis. */
const stanfordClaimsBasis = "295468d92021e9c4d7c199c6ca7189eed2d5585a9d6e664772eb2220f3f3afd8";

/**
 * Server-only eligibility check for Home V4 university guides.
 * Stanford and NUS require effective strong student snapshots + verified claims basis.
 * Bristol requires verified index recovery basis for taught assessment claims.
 */
export function isHomeV4GuideEligible(
  slug: string,
  claims: PolicyClaim[],
  hasStrongSnapshot: boolean
): boolean {
  if (slug === "stanford-university") {
    return hasStrongSnapshot && reviewedClaimsFingerprint(claims) === stanfordClaimsBasis;
  }
  if (slug === "university-of-bristol") {
    // Bristol has verified taught assessment claims; does not promise complete student snapshot
    return hasCurrentIndexRecoveryBasis("university-of-bristol", claims);
  }
  if (slug === "national-university-of-singapore") {
    return hasStrongSnapshot && hasCurrentIndexRecoveryBasis("national-university-of-singapore", claims);
  }
  return false;
}

export interface VerifiedGuideData {
  slug: string;
  isEligible: boolean;
  hasStrongSnapshot: boolean;
  claimsCount: number;
}

/**
 * Loads actual current claims and effective snapshot status for candidate guide schools.
 * Fail-closed: missing data or basis failure makes the school ineligible.
 */
export async function getVerifiedHomeV4Guides(): Promise<VerifiedGuideData[]> {
  const targetSlugs = [
    "stanford-university",
    "university-of-bristol",
    "national-university-of-singapore"
  ] as const;

  const results = await Promise.all(
    targetSlugs.map(async (slug) => {
      try {
        const [summary, loadedSnapshot] = await Promise.all([
          getStagedPublicSummaryBySlug(slug),
          getLoadedPolicySnapshotBySlug(slug)
        ]);
        if (!summary) return { slug, isEligible: false, hasStrongSnapshot: false, claimsCount: 0 };
        const hasStrong = Boolean(loadedSnapshot && isStrongStudentSnapshot(loadedSnapshot));
        const isEligible = isHomeV4GuideEligible(slug, summary.claims, hasStrong);
        return {
          slug,
          isEligible,
          hasStrongSnapshot: hasStrong,
          claimsCount: summary.claims.length
        };
      } catch {
        return { slug, isEligible: false, hasStrongSnapshot: false, claimsCount: 0 };
      }
    })
  );

  return results;
}
