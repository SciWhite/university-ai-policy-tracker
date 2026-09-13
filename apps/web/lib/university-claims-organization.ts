import type { PolicyClaim, PolicySnapshot } from "@uapt/shared";
import type { PolicySnapshotDimensionKey } from "@uapt/shared";
import {
  STUDENT_SNAPSHOT_DIMENSION_ORDER,
  STUDENT_SNAPSHOT_DIMENSION_TITLES
} from "@/components/student-policy-snapshot";
import { formatClaimType } from "@/components/claim-evidence-card";

/**
 * Deterministic grouping of reviewed claims for the index-recovery pilot.
 *
 * Two grouping modes, chosen by the page:
 *
 * 1. `groupReviewedClaimsBySnapshotDimensions` - for pages with an effective
 *    strong student policy snapshot. Group membership comes from the
 *    dual-agent-reviewed snapshot dimension basis (claim IDs), so the
 *    grouping reuses the project's reviewed classification. A claim bound to
 *    several dimensions renders once, under the first dimension in the
 *    contract order. Claims not bound to any dimension render under
 *    "Additional reviewed claims" so nothing is dropped.
 *
 * 2. `groupReviewedClaimsByClaimType` - for pilot pages without a published
 *    snapshot. Groups follow the public claim taxonomy (the record's own
 *    existing classification). A deterministic claimType-to-six-dimension
 *    mapping was rejected: it reproduced the reviewed snapshot dimension
 *    assignment for only 48.7% of the 113 claims bound across the 17 strong
 *    snapshots (validated 2026-09-12), so presenting such a mapping as
 *    six-dimension semantics would misstate reviewed conclusions.
 */

export interface ClaimGroup {
  /** Snapshot dimension key, claim type, or "additional". */
  key: string;
  title: string;
  claims: PolicyClaim[];
}

const CLAIM_TYPE_GROUP_ORDER = [
  "academic_integrity",
  "teaching",
  "privacy",
  "security_review",
  "research",
  "ai_tool_treatment",
  "procurement",
  "source_status",
  "other"
] as const;

const ADDITIONAL_CLAIMS_GROUP_KEY = "additional";
const ADDITIONAL_CLAIMS_GROUP_TITLE = "Additional reviewed claims";

function pluralizeClaim(count: number): string {
  return `${count} reviewed claim${count === 1 ? "" : "s"}`;
}

export function formatClaimGroupCount(count: number): string {
  return pluralizeClaim(count);
}

export function groupReviewedClaimsBySnapshotDimensions(
  claims: PolicyClaim[],
  snapshot: PolicySnapshot
): ClaimGroup[] {
  const binding = new Map<string, PolicySnapshotDimensionKey>();
  for (const key of STUDENT_SNAPSHOT_DIMENSION_ORDER) {
    const dimension = snapshot.dimensions.find((item) => item.key === key);
    if (!dimension) continue;
    for (const claimId of dimension.basis.claimIds) {
      if (!binding.has(claimId)) binding.set(claimId, key);
    }
  }

  const groups: ClaimGroup[] = [];
  const assigned = new Set<string>();

  for (const key of STUDENT_SNAPSHOT_DIMENSION_ORDER) {
    const dimension = snapshot.dimensions.find((item) => item.key === key);
    if (!dimension) continue;
    const groupClaims = claims.filter(
      (claim) =>
        claim.id !== undefined && binding.get(claim.id) === key
    );
    if (!groupClaims.length) continue;
    for (const claim of groupClaims) {
      if (claim.id !== undefined) assigned.add(claim.id);
    }
    groups.push({
      key,
      title: STUDENT_SNAPSHOT_DIMENSION_TITLES[key],
      claims: groupClaims
    });
  }

  const additional = claims.filter(
    (claim) => claim.id === undefined || !assigned.has(claim.id)
  );
  if (additional.length) {
    groups.push({
      key: ADDITIONAL_CLAIMS_GROUP_KEY,
      title: ADDITIONAL_CLAIMS_GROUP_TITLE,
      claims: additional
    });
  }

  return groups;
}

export function groupReviewedClaimsByClaimType(
  claims: PolicyClaim[]
): ClaimGroup[] {
  const groups: ClaimGroup[] = [];

  for (const claimType of CLAIM_TYPE_GROUP_ORDER) {
    const groupClaims = claims.filter((claim) => claim.claimType === claimType);
    if (!groupClaims.length) continue;
    groups.push({
      key: claimType,
      title: formatClaimType(claimType),
      claims: groupClaims
    });
  }

  return groups;
}
