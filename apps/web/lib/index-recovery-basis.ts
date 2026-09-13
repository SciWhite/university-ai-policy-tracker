import { createHash } from "node:crypto";
import type { PolicyClaim } from "@uapt/shared";

// Authored-content basis, pinned at review time. Never refresh automatically.
// Any substantive change requires rechecking the corresponding prose/title.
const basis: Record<string, string> = {
  "harvard-university": "d4ddd904e77f98abd67c650e5c8b8986fd8d2bcd71506d0fed0861ae127eb56b",
  "unsw-sydney": "fa2b6a69afa4ab64cc314537d4ff62cbfdc96c35a046baed3ecbff7ad48fabb4",
  "university-of-sydney": "970a9603644cb465e72451d7551f040182b264f89756a4836987f1fad4366f30",
  "national-university-of-singapore": "3c5fa443be38909382e6d292652461cbd607215b8013eea97f68d19d22c905f4",
  "university-of-oxford": "7fe89dd2478f017b26b46f0e14b07b2afb28c508ee85d9da874d2727d2ad713f",
  "utrecht-university": "aac62b714602e1faee841ef1b1e74f4f40913461e65a860185c58d0290dc9af8",
  "university-of-bristol": "4fa13114edfe0d0f43cb87e6f1cd3e5ef49392e970aeaf76f1272ba8b0e062b3",
  "manchester": "bc40df4a71799df4ca0f3ecbf60179835e7a4cf565cbf34f3be71b918d8e1d30",
  "edinburgh": "10788cb7734a3bdfd0412832e80a81dc775a62d6289d157323093b74e08bfe45",
  "deakin-university": "0a2f42cb72995ded4cfb0d3464ee541d6520cc4e9f5b25e926a96fdfe8a4d3d3"
};

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort()
      .filter((key) => key !== "lastCheckedAt" && key !== "retrievedAt")
      .map((key) => [key, stable(record[key])]));
  }
  return value;
}

export function hasCurrentIndexRecoveryBasis(slug: string, claims: PolicyClaim[]): boolean {
  if (!Object.hasOwn(basis, slug)) return false;
  const reviewed = claims.filter((claim) =>
    claim.reviewState === "agent_reviewed" || claim.reviewState === "human_reviewed");
  if (!reviewed.length) return false;
  const payload = reviewed.map(stable).sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex") === basis[slug];
}
