import { createHash } from "node:crypto";
import type { PolicyClaim } from "@uapt/shared";

// Authored-content basis, pinned at review time. Never refresh automatically.
// Any substantive change requires rechecking the corresponding prose/title.
const basis: Record<string, string> = {
  "harvard-university": "d4ddd904e77f98abd67c650e5c8b8986fd8d2bcd71506d0fed0861ae127eb56b",
  // Re-reviewed after the 2026-09-24 UNSW College ELICOS-only Mentor AI claim.
  // The assessment-category copy does not present that tool as campus-wide permission.
  "unsw-sydney": "45ea51a90fc062404b9f8fbf9f115ea2a13c91ebcc87559d5abb7f29e13ebf80",
  "university-of-sydney": "970a9603644cb465e72451d7551f040182b264f89756a4836987f1fad4366f30",
  "national-university-of-singapore": "3c5fa443be38909382e6d292652461cbd607215b8013eea97f68d19d22c905f4",
  "university-of-oxford": "7fe89dd2478f017b26b46f0e14b07b2afb28c508ee85d9da874d2727d2ad713f",
  "utrecht-university": "aac62b714602e1faee841ef1b1e74f4f40913461e65a860185c58d0290dc9af8",
  "university-of-bristol": "4fa13114edfe0d0f43cb87e6f1cd3e5ef49392e970aeaf76f1272ba8b0e062b3",
  "manchester": "bc40df4a71799df4ca0f3ecbf60179835e7a4cf565cbf34f3be71b918d8e1d30",
  "edinburgh": "10788cb7734a3bdfd0412832e80a81dc775a62d6289d157323093b74e08bfe45",
  "deakin-university": "0a2f42cb72995ded4cfb0d3464ee541d6520cc4e9f5b25e926a96fdfe8a4d3d3",
  "university-of-surrey": "944d7998918a03446d5c6c4b10e4b792efefa8fcd075973998ea4ba855b3d99d",
  "imperial-college-london": "0b465d7890d980b2a36ae110de87c6dc63e18f43511b3f8d7cba074d73eafcf6",
  "adelaide-university": "c53eae5b4af433f389f9810af4ec0537a3619a6a6b7e5ea252f32f6653984655",
  "de-la-salle-university": "693a32043f451e299373660948fd1958a8add58d9f4d31bfb654038f56c4cbf0",
  ubc: "2bcb450af5708d84b7dcf9249f06d8174fb7f65449fa2d47bd347bb1889c4704",
  "university-of-queensland": "a62105a027f3ab901d0329e232509b853fead4a60d5868628bc5fcb6e7e7db99",
  "university-of-johannesburg": "db902e9431eabe8be533806a99190d3f0ec70bd7d8e506d4b8ec6dd85d8d7342",
  anu: "c1b266cd77950e6badca8a3d9d123a7a6ac41fce7ac17e8886a2ab9e1de46acc",
  "durham-university": "f837ac49c40f9501afc0ded3f7a0b7ab0657477403ef807f103789b562cc28c0",
  "university-of-auckland": "6cea62bd3b35373175fffe3bb18bdefd31d83ddd68c5efd2964744e111447f2d"
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

export function reviewedClaimsFingerprint(claims: PolicyClaim[]): string | undefined {
  const reviewed = claims.filter((claim) =>
    claim.reviewState === "agent_reviewed" || claim.reviewState === "human_reviewed");
  if (!reviewed.length) return undefined;
  const payload = reviewed.map(stable).sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function hasCurrentIndexRecoveryBasis(slug: string, claims: PolicyClaim[]): boolean {
  return Object.hasOwn(basis, slug) && reviewedClaimsFingerprint(claims) === basis[slug];
}
