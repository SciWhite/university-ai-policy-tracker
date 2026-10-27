import type { PolicyClaim } from "@uapt/shared";
import type { PolicyV6Data, LabTopic } from "./policy-v6";

type OriginalClaim = Pick<PolicyClaim, "id" | "evidence">;
type Evidence = LabTopic["claims"][number]["evidence"][number];
const identity = (e: Evidence) => JSON.stringify([
  e.url, e.quote, e.title, e.language, e.location ?? null, e.retrievedAt ?? null,
]);

/** Shared presentation projection. Preserve per-evidence versions already bound
 * in validated inputs (including full source quotations outside canonical Claims).
 * Fill missing versions only by exact original Claim/evidence identity. No URL-level
 * inference, snapshot repin or mutation of the accepted package. */
export function bindPolicyV6ReadingEvidence(data: PolicyV6Data, claims: OriginalClaim[]): PolicyV6Data {
  const originals = new Map(claims.map(claim => [claim.id, claim]));
  const topic = (topic: LabTopic): LabTopic => ({ ...topic, claims: topic.claims.map(claim => {
    const raw = originals.get(claim.id)?.evidence ?? [];
    const versions = new Map<string, Set<string | undefined>>();
    for (const e of raw) {
      const key = identity({ url: e.sourceUrl, quote: e.evidenceSnippet,
        title: e.attribution.citationTitle, language: e.sourceLanguage ?? "und",
        location: e.snippetLocation, retrievedAt: e.retrievedAt });
      const hashes = versions.get(key) ?? new Set();
      hashes.add(e.sourceSnapshotHash || undefined);
      versions.set(key, hashes);
    }
    return { ...claim, evidence: claim.evidence.map(e => {
      if (e.hash) return { ...e };
      const hashes = versions.get(identity(e));
      return { ...e, hash: hashes?.size === 1 ? [...hashes][0] : undefined };
    }) };
  }) });
  return { ...data, schools: data.schools.map(school => school.slug !== data.currentSlug ? school : ({
    ...school, topics: school.topics.map(topic), additionalTopics: school.additionalTopics.map(topic),
  })) };
}
