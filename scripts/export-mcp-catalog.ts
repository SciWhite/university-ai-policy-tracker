import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentPublicReleaseManifest, getStagedPublicDataset } from "../apps/web/lib/staged-public-data";
import { getEntityResolutionRecords } from "../apps/web/lib/entity-search";
import { getLoadedPolicySnapshotIndex } from "../apps/web/lib/policy-snapshots";
import { catalogPayloadSchema, digest, eligibleClaims } from "../apps/mcp/src/catalog";

async function main() {
// The distributable catalog always cites the public site, including local QA exports.
process.env.NEXT_PUBLIC_SITE_URL = "https://eduaipolicy.org";
const manifest = await getCurrentPublicReleaseManifest();
const approved = JSON.parse(await readFile("data/public-releases/current.json","utf8"));
if (!manifest || approved.candidateOnly !== false || digest(manifest) !== digest(approved)) throw new Error("Only the committed current published manifest can be exported; candidate overrides are refused");
const [dataset, aliases, snapshots] = await Promise.all([
  getStagedPublicDataset(), getEntityResolutionRecords(), getLoadedPolicySnapshotIndex()
]);
const records = dataset.publicSummaries.flatMap(summary => {
  const entity = aliases.find(a => a.entitySlug === summary.entity.slug);
  const record = { summary, aliases: entity?.aliases.map(a => a.alias) ?? [], country: entity?.country };
  const claims = eligibleClaims(record);
  const snapshot = snapshots.entries.find(s => s.universitySlug === summary.entity.slug)?.loaded;
  return [{ ...record, summary: { ...summary, claims },
    snapshot: snapshot?.validation.effectiveStatus === "strong" &&
      snapshot.snapshot.basis.claimIds.every(id => claims.some(c => c.id === id))
      ? snapshot.snapshot : undefined }];
});
const payload = catalogPayloadSchema.parse({ schemaVersion: "uapt-mcp-catalog-v1", publicationState:"published", releaseId: manifest.releaseId,
  releasePublishedAt: manifest.publishedAt, exportedAt: new Date().toISOString(), records });
const out = path.resolve(process.env.UAPT_MCP_CATALOG_OUTPUT ?? "apps/mcp/.runtime-data/catalog.json");
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, JSON.stringify({ sha256: digest(payload), payload }));
console.log(JSON.stringify({ file: out, releaseId: payload.releaseId, universities: records.length,
  claims: records.reduce((n,r) => n + r.summary.claims.length, 0), strongSnapshots: records.filter(r => r.snapshot).length }));

}
main().catch(() => { console.error("MCP catalog export failed"); process.exitCode = 1; });
