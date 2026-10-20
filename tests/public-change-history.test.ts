import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { getEntityChangeHistory, changeHistoryCacheStats, buildPublicHistoryProjection } from "../apps/web/lib/change-records";
import { readPublicChangeHistory, readPublicReleaseDiff } from "../apps/web/lib/public-change-history";
import { buildSitemapSection, type SitemapSectionId } from "../apps/web/lib/sitemap-sections";
import { getStagedCatalogUniversities } from "../apps/web/lib/staged-public-data";
import { getEntityAliasResolver } from "../apps/web/lib/entity-aliases";

// Compare against the distributable export, which always uses public citations.
process.env.NEXT_PUBLIC_SITE_URL = "https://eduaipolicy.org";

test("cold single-school history reads preserve merged claims without constructing global history", async () => {
  const start = performance.now();
  const history = await getEntityChangeHistory("brunel-university-of-london");
  assert.ok(history);
  assert.equal(history.record.claimCount, 6);
  assert.ok(history.releaseRecords.flatMap(r => r.diffRows).some(row => row.newClaim?.claimId === "cl-brunel-university-london-institutional-ai-service-815"));
  assert.ok(performance.now() - start < 3000);
  assert.equal(changeHistoryCacheStats().releases.entries, 0);
  assert.equal(changeHistoryCacheStats().releases.pending, 0);
  const first = await readPublicChangeHistory("brunel-university-of-london");
  const saved = JSON.stringify(first);
  first.length = 0;
  assert.equal(JSON.stringify(await readPublicChangeHistory("brunel-university-of-london")), saved);
  assert.deepEqual(await readPublicChangeHistory("constructor"), []);
  assert.equal(await readPublicReleaseDiff("constructor"), undefined);
});

test("every exported historical row equals the original full public diff reconstruction", async () => {
  const { histories: expected, releases } = await buildPublicHistoryProjection();
  const pointer = JSON.parse(await readFile("data/public-change-history/current.json", "utf8"));
  const bytes = await readFile(`data/public-change-history/${pointer.path}`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), pointer.sha256);
  const manifest = JSON.parse(bytes.toString());
  assert.deepEqual(Object.keys(manifest.entries).sort(), Object.keys(expected).sort());
  for (const [slug, records] of Object.entries(expected)) {
    // The persisted public JSON omits optional properties whose value is undefined.
    assert.deepEqual(await readPublicChangeHistory(slug), JSON.parse(JSON.stringify(records)), slug);
  }
  assert.deepEqual(Object.keys(manifest.releases).sort(), Object.keys(releases).sort());
  for (const [releaseId, diff] of Object.entries(releases)) {
    assert.deepEqual(await readPublicReleaseDiff(releaseId), JSON.parse(JSON.stringify(diff)), releaseId);
  }
});

test("university and localized sitemap sections contain each canonical university exactly once", async () => {
  const universities = await getStagedCatalogUniversities();
  const { slugAliases } = await getEntityAliasResolver();
  for (const section of ["universities", "zh", "fr", "pl"] as SitemapSectionId[]) {
    const entries = await buildSitemapSection(section);
    assert.equal(new Set(entries.map(e => e.url)).size, entries.length, section);
    const schools = entries.filter(e => /\/universities\/[^/]+$/.test(e.url));
    assert.equal(schools.length, universities.length, section);
    assert.ok(schools.every(e => !slugAliases.has(e.url.split("/").pop()!)));
    const eth = schools.filter(e => e.url.endsWith("/universities/eth-zurich"));
    assert.equal(eth.length, 1);
    assert.ok(eth[0].lastModified >= new Date("2026-10-02T00:00:00Z"));
  }
});
