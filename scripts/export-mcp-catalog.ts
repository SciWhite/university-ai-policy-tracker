import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { publicEntitySummarySchema } from "@uapt/shared";
import { getCurrentPublicReleaseManifest, getStagedPublicDataset } from "../apps/web/lib/staged-public-data";
import { getEntityResolutionRecords } from "../apps/web/lib/entity-search";
import { getLoadedPolicySnapshotIndex, validatePolicySnapshotAgainstPublicData } from "../apps/web/lib/policy-snapshots";
import { readV6RecordCorrections, v6RecordSlugs, v6SummaryAtRevision } from "../apps/web/lib/v6-effective-records";
import { catalogPayloadSchema, digest, eligibleClaims, loadCatalog, type Record as CatalogRecord } from "../apps/mcp/src/catalog";

export async function exportMcpCatalog() {
  // CLI exports the committed public selection, never a local preview or a live self-fetch.
  if (Object.entries(process.env).some(([key, value]) => value &&
    (key.startsWith("UAPT_LOCAL_QA_") || key.startsWith("UAPT_CANDIDATE_REPAIR_") ||
      ["UAPT_PUBLIC_RELEASE_MANIFEST", "UAPT_PUBLIC_DATA_ROOT", "UAPT_V6_LEGACY_DATA"].includes(key)))) {
    throw new Error("MCP export refuses candidate or data-root overrides");
  }
  process.env.NEXT_PUBLIC_SITE_URL = "https://eduaipolicy.org";
  process.env.UAPT_V6_PUBLISHED_PAGES = "1";
  const manifest = await getCurrentPublicReleaseManifest();
  const approved = JSON.parse(await readFile("data/public-releases/current.json", "utf8"));
  if (!manifest || approved.candidateOnly !== false || digest(manifest) !== digest(approved)) {
    throw new Error("Only the committed current published manifest can be exported");
  }
  const [dataset, aliases, snapshots] = await Promise.all([
    getStagedPublicDataset(), getEntityResolutionRecords(), getLoadedPolicySnapshotIndex()
  ]);
  const corrections = readV6RecordCorrections();
  const correctedSlugs = new Set(v6RecordSlugs());
  if (!corrections || corrections.datasetReleaseId !== manifest.releaseId) throw new Error("Published correction dataset mismatch");
  const baseSlugs = new Set(dataset.publicSummaries.map(summary => summary.entity.slug));
  if ([...correctedSlugs].some(slug => !baseSlugs.has(slug))) throw new Error("Published correction has no canonical base identity");
  const aliasesBySlug = new Map(aliases.map(entity => [entity.entitySlug, entity]));
  const snapshotsBySlug = new Map(snapshots.entries.map(entry => [entry.universitySlug, entry.loaded]));
  const coverage: Array<{ slug: string; revision?: string; claimIds: string[]; excludedBaseClaimIds: string[]; historicalClaimIds: string[]; tools: number; snapshot: string }> = [];
  const records: CatalogRecord[] = dataset.publicSummaries.map(base => {
    const slug = base.entity.slug;
    const summary = correctedSlugs.has(slug) ? v6SummaryAtRevision(slug) : base;
    if (!summary || summary.entity.slug !== slug || summary.entitySlug !== slug) throw new Error("Published correction identity mismatch");
    const revision = correctedSlugs.has(slug) ? corrections.recordRevisions[slug] : undefined;
    if (correctedSlugs.has(slug) && (!revision || revision.datasetReleaseId !== manifest.releaseId || revision.recordSha256 !== digest(summary))) {
      throw new Error(`Published correction fingerprint mismatch: ${slug}`);
    }
    const historicalClaimIds = revision ? (corrections.heldBySlug[slug] ?? []).map(c => c.id!) : [];
    if (historicalClaimIds.some(id => summary.claims.some(c => c.id === id))) throw new Error("Held claim selected as current");
    const entity = aliasesBySlug.get(slug);
    const record: CatalogRecord = {
      summary,
      aliases: [...new Set([...(entity?.aliases.map(a => a.alias) ?? []), ...(revision ? corrections.aliasesBySlug[slug] ?? [] : []), ...summary.entity.aliases])],
      country: entity?.country
    };
    const claims = eligibleClaims(record);
    if (revision && claims.length !== summary.claims.length) throw new Error(`Ineligible published correction claim: ${slug}`);
    record.summary = { ...summary, claims };
    const snapshot = revision ? corrections.snapshots[slug] : snapshotsBySlug.get(slug)?.snapshot;
    if (snapshot && validatePolicySnapshotAgainstPublicData(snapshot, record.summary, manifest.releaseId).effectiveStatus === "strong" &&
      snapshot.basis.claimIds.every(id => claims.some(c => c.id === id))) record.snapshot = snapshot;
    if (revision) Object.assign(record, {
      universityRevisionId: revision.universityRevisionId,
      recordSha256: revision.recordSha256,
      summarySha256: digest(publicEntitySummarySchema.parse(record.summary)),
      recordPublishedAt: revision.publishedAt,
      historicalClaimIds,
      tools: corrections.toolsBySlug[slug] ?? [],
      ...(!record.snapshot ? { snapshotUnavailableReason: snapshot ? "pending_review" : "not_published" } : {})
    });
    coverage.push({ slug, revision: revision?.universityRevisionId, claimIds: claims.map(c => c.id!),
      excludedBaseClaimIds: revision ? [] : summary.claims.filter(c => !claims.some(eligible => eligible.id === c.id)).map(c => c.id!),
      historicalClaimIds, tools: record.tools?.length ?? 0, snapshot: record.snapshot ? "strong" : record.snapshotUnavailableReason ?? "unavailable" });
    return record;
  });
  const payload = catalogPayloadSchema.parse({ schemaVersion: "uapt-mcp-catalog-v1", publicationState: "published", releaseId: manifest.releaseId,
    releasePublishedAt: manifest.publishedAt, exportedAt: new Date().toISOString(), records });
  const out = path.resolve(process.env.UAPT_MCP_CATALOG_OUTPUT ?? "apps/mcp/.runtime-data/catalog.json");
  await mkdir(path.dirname(out), { recursive: true });
  const temporary = `${out}.${process.pid}.candidate`;
  try {
    await writeFile(temporary, JSON.stringify({ sha256: digest(payload), payload }), { flag: "wx" });
    // Includes strict review/fingerprint/tool checks before replacing a usable catalog.
    await loadCatalog(temporary);
    await rename(temporary, out);
  } finally { await rm(temporary, { force: true }); }
  return { file: out, releaseId: payload.releaseId, publishedRecordRevision: corrections.revision,
    universities: records.length, correctedUniversities: correctedSlugs.size,
    claims: records.reduce((n, r) => n + r.summary.claims.length, 0),
    tools: records.reduce((n, r) => n + (r.tools?.length ?? 0), 0),
    strongSnapshots: records.filter(r => r.snapshot).length, catalogDigest: digest(payload), coverage };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  exportMcpCatalog().then(({ coverage, ...result }) => console.log(JSON.stringify(result))).catch(error => {
    // No connection credentials or private input paths in command output.
    console.error(error instanceof Error ? error.message : "MCP catalog export failed"); process.exitCode = 1;
  });
}
