import { policyAnalysisProfileSchema, policyAnalysisDimensionKeySchema, type PolicyAnalysisProfile } from "@uapt/shared";
import type { LocalV6Bundle } from "./policy-v6-bundle";

/** Optional private projection contract. Published analysis generation is unchanged. */
export interface LocalV6AnalysisProjection {
  profile: PolicyAnalysisProfile;
  topicDimensions: Record<string, PolicyAnalysisProfile["dimensions"][number]["key"]>;
}

/** Enforce explicit evidence and actual UI projection bindings; this is not semantic approval. */
export function validateLocalV6AnalysisProjection(view: LocalV6Bundle): void {
  const projection = view.analysisProjection;
  if (!projection) return; // Historical bundles retain their existing contracts.
  const profile = policyAnalysisProfileSchema.parse(projection.profile);
  if (profile.entitySlug !== view.school.slug || profile.entityName !== view.school.name ||
      profile.reviewState !== "machine_candidate") throw new Error("Invalid local analysis identity/review boundary");
  const sameSet = (a: string[], b: string[]) => a.length === new Set(a).size &&
    b.length === new Set(b).size && [...a].sort().join("\n") === [...b].sort().join("\n");
  if (!sameSet(profile.dimensions.map(d => d.key), policyAnalysisDimensionKeySchema.options))
    throw new Error("Local analysis requires all eleven explicit dimensions");
  const claims = new Map(view.claims.map(c => [c.id, c]));
  for (const dimension of profile.dimensions) {
    if (!sameSet(dimension.evidenceClaimIds, [...new Set(dimension.basis.map(b => b.claimId))]) ||
        !sameSet(dimension.evidenceSourceUrls, [...new Set(dimension.basis.map(b => b.sourceUrl))]))
      throw new Error(`Incomplete local analysis basis: ${dimension.key}`);
    for (const basis of dimension.basis) {
      const claim = claims.get(basis.claimId);
      if (!claim || claim.reviewState !== "agent_reviewed" || !claim.evidence.some(e =>
        e.sourceUrl === basis.sourceUrl && e.sourceSnapshotHash === basis.sourceSnapshotHash &&
        e.evidenceSnippet === basis.evidenceSnippet && (e.sourceLanguage ?? "und") === basis.sourceLanguage))
        throw new Error(`Unbound local analysis evidence: ${dimension.key}/${basis.claimId}`);
    }
  }
  if (!sameSet(profile.basedOnClaimIds, [...new Set(profile.dimensions.flatMap(d => d.evidenceClaimIds))]))
    throw new Error("Local analysis aggregate claim binding differs");
  for (const component of profile.coverageScore.components) {
    const dimension = profile.dimensions.find(d => d.key === component.key);
    const uncertain = !dimension || ["unclear", "not_mentioned", "insufficient_public_evidence"].includes(dimension.status);
    if (!dimension || component.status !== dimension.status ||
        !sameSet(component.evidenceClaimIds, dimension.evidenceClaimIds) ||
        component.points !== (uncertain ? 0 : component.maxPoints))
      throw new Error(`Local coverage score does not follow explicit evidence: ${component.key}`);
  }
  const topics = [...view.school.topics, ...view.school.additionalTopics];
  if (!sameSet(Object.keys(projection.topicDimensions), topics.map(t => t.key)))
    throw new Error("Incomplete local topic/analysis mapping");
  for (const topic of topics) {
    const dimension = profile.dimensions.find(d => d.key === projection.topicDimensions[topic.key]);
    const displayedClaimIds = topic.claims.filter(c => c.basisObjectType !== "source").map(c => c.id);
    if (!dimension || topic.status !== (dimension.status === "not_mentioned" ? "unclear" : dimension.status) ||
        !sameSet(displayedClaimIds, dimension.evidenceClaimIds) ||
        (view.topicSummaries?.[topic.key]?.en ?? topic.summary) !== dimension.summary)
      throw new Error(`Local topic differs from explicit analysis: ${topic.key}`);
    for (const row of topic.claims.filter(c => c.basisObjectType !== "source")) {
      const claim = claims.get(row.id);
      if (!claim || row.text !== claim.claimText || row.evidence.length !== claim.evidence.length ||
          row.evidence.some((e, i) => e.quote !== claim.evidence[i].evidenceSnippet || e.url !== claim.evidence[i].sourceUrl))
        throw new Error(`Local topic claim differs from exact evidence: ${topic.key}/${row.id}`);
    }
  }
}
