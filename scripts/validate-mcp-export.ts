import assert from "node:assert/strict";
import { publicEntitySummarySchema, universityToolRecordSchema } from "@uapt/shared";
import { createHash } from "node:crypto";
import { writeFile, readFile } from "node:fs/promises";
import { getStagedPublicDataset } from "../apps/web/lib/staged-public-data";
import { v6RecordSlugs, v6SummaryAtRevision, readV6RecordCorrections } from "../apps/web/lib/v6-effective-records";
import { loadCatalog, eligibleClaims, digest, topics, type Record as CatalogRecord } from "../apps/mcp/src/catalog";
import { PolicyService } from "../apps/mcp/src/policy";
import { policyOutput, evidenceOutput, resolutionOutput } from "../apps/mcp/src/output-schemas";
import { validatePolicySnapshotAgainstPublicData } from "../apps/web/lib/policy-snapshots";

async function main() {
  process.env.UAPT_V6_PUBLISHED_PAGES = "1";
  process.env.NEXT_PUBLIC_SITE_URL = "https://eduaipolicy.org";
  const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value));
  const file = process.env.UAPT_MCP_CATALOG_OUTPUT ?? "apps/mcp/.runtime-data/catalog.json";
  const catalog = await loadCatalog(file);
  const dataset = await getStagedPublicDataset();
  const selected = new Set(v6RecordSlugs());
  const corrections = readV6RecordCorrections()!;
  const bySlug = new Map(catalog.records.map(record => [record.summary.entity.slug, record]));
  assert.deepEqual([...bySlug.keys()].sort(), dataset.publicSummaries.map(s => s.entity.slug).sort());
  const service = new PolicyService(catalog);
  let checkedClaims = 0, checkedTools = 0, historicalIds = 0, topicCalls = 0;
  const coverage: Array<{slug:string;claimIds:string[];tools:number;heldClaimIds:string[];snapshot:string;remainingClaimIds:string[]}> = [];
  for (const base of dataset.publicSummaries) {
    const slug = base.entity.slug;
    const record = bySlug.get(slug)!;
    const summary = selected.has(slug) ? v6SummaryAtRevision(slug)! : base;
    const expected = { ...summary, claims: eligibleClaims({ summary, aliases: [] } as CatalogRecord) };
    assert.deepEqual(record.summary, wire(publicEntitySummarySchema.parse(expected)), `${slug}: complete effective published summary`);
    if (selected.has(slug)) {
      const revision = corrections.recordRevisions[slug];
      assert.equal(record.recordSha256, revision.recordSha256);
      assert.equal(record.recordSha256, digest(summary));
      assert.equal(record.summarySha256, digest(record.summary));
      assert.equal(record.universityRevisionId, revision.universityRevisionId);
      assert.equal(record.recordPublishedAt, revision.publishedAt);
      assert.deepEqual(record.tools, wire((corrections.toolsBySlug[slug] ?? []).map(tool => universityToolRecordSchema.parse(tool))));
      assert.deepEqual(record.historicalClaimIds, (corrections.heldBySlug[slug] ?? []).map(c => c.id));
      const snapshot = corrections.snapshots[slug];
      const valid = snapshot && validatePolicySnapshotAgainstPublicData(snapshot, record.summary, catalog.releaseId).effectiveStatus === "strong";
      assert.deepEqual(record.snapshot, valid ? wire(snapshot) : undefined, `${slug}: no inherited approval or historical snapshot`);
      if (!valid) assert.equal(record.snapshotUnavailableReason, snapshot ? "pending_review" : "not_published");
      for (const id of record.historicalClaimIds ?? []) assert(!record.summary.claims.some(c => c.id === id));
    } else {
      assert.equal(record.universityRevisionId, undefined);
      assert.equal(record.tools, undefined);
    }
    resolutionOutput.parse(service.resolve(slug));
    const response = policyOutput.parse(service.policy(slug));
    const ids = [...response.claims!.map(c => c.id), ...response.remainingClaimIds!];
    assert.deepEqual(ids.slice().sort(), record.summary.claims.map(c => c.id).sort());
    for (let i = 0; i < ids.length; i += 10) {
      const evidence = evidenceOutput.parse(service.evidence(slug, ids.slice(i, i + 10)));
      assert.deepEqual(evidence.missingClaimIds, []);
      for (const claim of evidence.claims) {
        const {trackerEvidenceUrl, ...original} = claim;
        assert.deepEqual(wire(original), record.summary.claims.find(c => c.id === claim.id));
        assert(trackerEvidenceUrl.includes(encodeURIComponent(claim.id!)));
      }
    }
    for (const topic of topics) {
      const focused = policyOutput.parse(service.policy(slug, [topic]));
      topicCalls++;
      assert.equal(focused.claims!.length + focused.remainingClaimIds!.length, focused.totalRelevantClaims);
      assert(focused.claims!.length <= 15);
      assert(focused.claims!.every(c => ids.includes(c.id)));
      assert(focused.remainingClaimIds!.every(id => ids.includes(id)));
    }
    checkedClaims += ids.length; checkedTools += record.tools?.length ?? 0; historicalIds += record.historicalClaimIds?.length ?? 0;
    coverage.push({slug,claimIds:ids,tools:record.tools?.length ?? 0,heldClaimIds:record.historicalClaimIds ?? [],snapshot:record.snapshot ? "strong" : "unavailable",remainingClaimIds:[]});
  }
  const current = await readFile("data/public-v6-records/current.json");
  const report = { status:"PASS", catalogDigest:digest(catalog), publishedPointerSha256:createHash("sha256").update(current).digest("hex"), universities:bySlug.size, correctedUniversities:selected.size, claims:checkedClaims, tools:checkedTools, historicalIds, topicCalls, snapshots:catalog.records.filter(r=>r.snapshot).length, remainingClaimIds:[], coverage };
  if (process.env.UAPT_MCP_ACCEPTANCE_OUTPUT) await writeFile(process.env.UAPT_MCP_ACCEPTANCE_OUTPUT, JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,coverage:undefined}));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
