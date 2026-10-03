import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { publicEntitySummarySchema, policySnapshotSchema } from "@uapt/shared";

export const topics = ["coursework", "exams", "disclosure", "privacy_data", "approved_tools", "research_publication", "academic_integrity", "ai_detection"] as const;
export const topicSchema = z.enum(topics);
export type Topic = typeof topics[number];
export const catalogPayloadSchema = z.object({
  schemaVersion: z.literal("uapt-mcp-catalog-v1"),
  publicationState: z.literal("published"),
  releaseId: z.string().regex(/^public-release-[a-z0-9-]+$/),
  releasePublishedAt: z.string().datetime(),
  exportedAt: z.string().datetime(),
  records: z.array(z.object({
    summary: publicEntitySummarySchema,
    aliases: z.array(z.string()),
    country: z.string().optional(),
    snapshot: policySnapshotSchema.optional()
  }))
});
export type Catalog = z.infer<typeof catalogPayloadSchema>;
export type Record = Catalog["records"][number];
export const digest = (payload: unknown) => createHash("sha256").update(JSON.stringify(payload)).digest("hex");

export function eligibleClaims(record: Record) {
  return record.summary.claims.filter(claim =>
    claim.id && claim.entityType === "university" && claim.entitySlug === record.summary.entity.slug &&
    ["agent_reviewed", "human_reviewed"].includes(claim.reviewState) &&
    claim.evidence.length > 0 && claim.evidence.every(e =>
      e.attribution.official && e.attribution.sourceType !== "archived_official_source" &&
      e.sourceUrl === e.attribution.sourceUrl && e.sourceSnapshotHash === e.attribution.snapshotHash &&
      ["https:", "http:"].includes(new URL(e.sourceUrl).protocol))
  );
}

export async function loadCatalog(file: string): Promise<Catalog> {
  const envelope = JSON.parse(await readFile(file, "utf8"));
  if (envelope.sha256 !== digest(envelope.payload)) throw new Error("Catalog digest mismatch");
  const catalog = catalogPayloadSchema.parse(envelope.payload);
  const seen = new Set<string>();
  for (const record of catalog.records) {
    const slug = record.summary.entity.slug;
    if (seen.has(slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || record.summary.entitySlug !== slug || record.summary.entity.type !== "university" || record.summary.entityType !== "university") throw new Error("Invalid or duplicate university");
    seen.add(slug);
    if (eligibleClaims(record).length !== record.summary.claims.length) throw new Error("Ineligible catalog claim");
    if (new Set(record.summary.claims.map(c => c.id)).size !== record.summary.claims.length) throw new Error("Duplicate catalog claim");
    const snapshot = record.snapshot;
    if (snapshot && (snapshot.releaseId !== catalog.releaseId || snapshot.universitySlug !== slug || snapshot.overallStatus !== "strong")) throw new Error("Ineligible snapshot");
    if (snapshot) {
      const claims = new Map(record.summary.claims.map(c => [c.id, c]));
      if (snapshot.basis.claimIds.some(id => !claims.has(id))) throw new Error("Missing snapshot basis");
      const sortSources = (sources: {sourceUrl: string; sourceSnapshotHash: string}[]) => sources.slice().sort((a,b) => a.sourceUrl.localeCompare(b.sourceUrl) || a.sourceSnapshotHash.localeCompare(b.sourceSnapshotHash));
      const fingerprintClaims = snapshot.basis.claimIds.slice().sort().map(id => {
        const c = claims.get(id)!;
        return { id:c.id, claimType:c.claimType, claimText:c.claimText, claimValue:c.claimValue ?? null, reviewState:c.reviewState,
          evidence:sortSources(c.evidence.map(e=>({sourceUrl:e.sourceUrl,sourceSnapshotHash:e.sourceSnapshotHash}))) };
      });
      const expectedSources = new Map<string, {sourceUrl:string;sourceSnapshotHash:string}>();
      for (const id of snapshot.basis.claimIds) for (const e of claims.get(id)!.evidence) expectedSources.set(e.sourceUrl,{sourceUrl:e.sourceUrl,sourceSnapshotHash:e.sourceSnapshotHash});
      if (JSON.stringify(sortSources([...expectedSources.values()])) !== JSON.stringify(sortSources(snapshot.basis.sources))) throw new Error("Snapshot source basis mismatch");
      const fingerprint = digest({releaseId:catalog.releaseId,claims:fingerprintClaims,sources:sortSources(snapshot.basis.sources)});
      if (fingerprint !== snapshot.basisFingerprint || snapshot.review.reviewState !== "dual_agent_reviewed" ||
        snapshot.review.primary.decision !== "approve" || snapshot.review.secondary.decision !== "approve" || snapshot.review.agreement !== "agree") throw new Error("Snapshot review or fingerprint mismatch");
    }
  }
  if (!catalog.records.length) throw new Error("Empty catalog");
  return catalog;
}
