import type { Catalog, Record, Topic } from "./catalog.js";
import { normalizeForSearch } from "@uapt/shared";

const boundary = "Use the linked official text and preserve its institution, unit, audience, course and assessment scope. Tool availability is not assessment permission. Generic misconduct sanctions do not establish AI-specific penalties. Retrieval dates are not effective dates or a guarantee of current policy.";
const tracker = (slug: string) => `https://eduaipolicy.org/universities/${slug}?utm_source=chatgpt&utm_medium=plugin&utm_campaign=student_policy`;
export class PolicyService {
  private bySlug: Map<string, Record>;
  constructor(readonly catalog: Catalog) { this.bySlug = new Map(catalog.records.map(r => [r.summary.entity.slug, r])); }
  has(slug: string) { return this.bySlug.has(slug); }
  private base() { return { releaseId: this.catalog.releaseId, releasePublishedAt: this.catalog.releasePublishedAt, limitations: [boundary,
    "Live availability of official URLs is not checked by these tools. If a source cannot be opened, identify the answer as based on recorded evidence and do not claim fresh verification."] }; }
  private recordBase(record: Record) {
    const base = this.base();
    return {...base, limitations:[...new Set([...base.limitations,...record.summary.limitations,...(record.snapshot?.limitations ?? [])])]};
  }
  resolve(name: string) {
    const query = normalizeForSearch(name);
    const matches = this.catalog.records.map(record => {
      const labels = [record.summary.entity.name, record.summary.entity.slug, ...record.aliases];
      const exact = labels.some(a => normalizeForSearch(a) === query);
      const partial = query.length >= 4 && labels.some(a => normalizeForSearch(a).includes(query));
      return { record, score: exact ? 2 : partial ? 1 : 0 };
    }).filter(r => r.score > 0).sort((a,b) => b.score-a.score || a.record.summary.entity.slug.localeCompare(b.record.summary.entity.slug));
    const exact = matches.filter(m => m.score === 2);
    const resolved = exact.length === 1 || (exact.length === 0 && matches.length === 1);
    return { ...this.base(), status: matches.length ? resolved ? "resolved" : "ambiguous" : "not_found",
      candidates: matches.slice(0,10).map(({record}) => ({ slug: record.summary.entity.slug, name: record.summary.entity.name, country: record.country, trackerUrl: tracker(record.summary.entity.slug) })),
      ...(resolved ? { slug: (exact[0] ?? matches[0]).record.summary.entity.slug } : {}),
      ...(matches.length > 10 ? { moreCandidates: true } : {}) };
  }
  policy(slug: string, requested: Topic[] = []) {
    const record = this.bySlug.get(slug);
    if (!record) return { ...this.base(), status: "not_found", message: "No eligible published record matched this slug. Resolve the university first." };
    const snapshot = record.snapshot;
    const dimensions = snapshot?.dimensions.filter(d => (!requested.length || requested.includes(d.key)) &&
      !["not_mentioned", "insufficient_public_evidence"].includes(d.status)) ?? [];
    const relevantClaims = requested.length ? record.summary.claims.filter(c =>
      dimensions.some(d => d.basis.claimIds.includes(c.id!)) || requested.some(t => claimMatchesTopic(c, t))) : record.summary.claims;
    const claims = relevantClaims.slice(0,15);
    const insufficientTopics = requested.filter(t => !dimensions.some(d => d.key === t) && !relevantClaims.some(c => claimMatchesTopic(c,t)));
    return { ...this.recordBase(record), status: claims.length || dimensions.length ? "ok" : "insufficient_evidence", university: record.summary.entity.name, slug,
      lastCheckedAt: record.summary.lastCheckedAt, trackerUrl: tracker(slug), publicJsonUrl: `https://eduaipolicy.org/api/public/v1/universities/${slug}.json`,
      ...(snapshot ? { snapshotStatus: "strong", scope: snapshot.scope, audiences: snapshot.audiences, summary: requested.length ? undefined : snapshot.summary } : { snapshotStatus: "unavailable", summary: record.summary.claims.length ? "Reviewed claims are provided below; no eligible current student summary is available." : "No eligible reviewed claims are currently available. This does not mean the university has no policy." }),
      dimensions, claims: claims.map(c => ({ id: c.id, claimType: c.claimType, text: c.claimText, confidence: c.confidence, reviewState: c.reviewState,
        lastCheckedAt: c.lastCheckedAt, trackerEvidenceUrl: `${tracker(slug)}#claim-${encodeURIComponent(c.id!)}`, officialSourceUrls: [...new Set(c.evidence.map(e => e.sourceUrl))] })),
      totalRelevantClaims: relevantClaims.length, remainingClaimIds: relevantClaims.slice(15).map(c => c.id), insufficientTopics,
      ...(insufficientTopics.length ? { evidenceNotice: "The published evidence does not support a conclusion for these topics. This does not mean the university has no rule." } : {}) };
  }
  evidence(slug: string, ids: string[]) {
    const record = this.bySlug.get(slug);
    if (!record) return { ...this.base(), status: "not_found", claims: [] };
    const claims = record.summary.claims.filter(c => ids.includes(c.id!));
    const missingClaimIds = ids.filter(id => !claims.some(c => c.id === id));
    return { ...this.recordBase(record), status: missingClaimIds.length ? "insufficient_evidence" : "ok", slug, trackerUrl: tracker(slug),
      evidenceUrl: `https://eduaipolicy.org/api/public/v1/universities/${slug}.json`,
      claims: claims.map(c => ({ ...c, trackerEvidenceUrl: `${tracker(slug)}#claim-${encodeURIComponent(c.id!)}` })), missingClaimIds };
  }
}

// These selectors retrieve evidence, not permission classifications or new policy conclusions.
function claimMatchesTopic(claim: Record["summary"]["claims"][number], topic: Topic): boolean {
  switch(topic) {
    case "coursework": return claim.claimType === "teaching";
    case "exams": return /\b(exam|examination|assessment|quiz)\b/i.test(claim.claimText);
    case "disclosure": return /\b(disclos\w*|acknowledg\w*|declar\w*|citat\w*)\b/i.test(claim.claimText);
    case "privacy_data": return claim.claimType === "privacy" || claim.claimType === "security_review";
    case "approved_tools": return claim.claimType === "ai_tool_treatment" || claim.claimType === "procurement";
    case "research_publication": return claim.claimType === "research";
    case "academic_integrity": return claim.claimType === "academic_integrity";
    case "ai_detection": return /\b(detect\w*|turnitin)\b/i.test(claim.claimText);
  }
}
