import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs, { readFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import * as datasetRoute from "../apps/web/app/api/public/v1/datasets/[artifact]/route";
import * as snapshotRoute from "../apps/web/app/api/public/v1/datasets/release-snapshots/[releaseId]/[artifact]/route";
import {
  datasetReleaseCacheStats, getDatasetRelease, getDatasetReleaseForPublicManifest
} from "../apps/web/lib/dataset-release";
import { getCurrentPublicReleaseManifest, getStagedPublicDatasetForManifest, type PublicReleaseManifest } from "../apps/web/lib/staged-public-data";
import { getMonthlyReport, getReportsIndex, monthlyReportCacheStats } from "../apps/web/lib/reports";
import { monthlyReportRegistry, monthlyReportSlugs } from "../apps/web/lib/monthly-report-registry";
import { findRepoRoot } from "../apps/web/lib/repo-root";

test("on-demand download routes retain validation without enumerating publication history", async () => {
  assert.deepEqual(datasetRoute.generateStaticParams(), []);
  assert.deepEqual(snapshotRoute.generateStaticParams(), []);
  assert.equal(datasetRoute.dynamicParams, true);
  assert.equal(snapshotRoute.dynamicParams, true);
  assert.equal(datasetRoute.dynamic, "force-static");
  assert.equal(snapshotRoute.dynamic, "force-static");
  const before = datasetReleaseCacheStats();
  const response = await datasetRoute.GET(new Request("https://eduaipolicy.org/api/public/v1/datasets/unknown.jsonl"), {
    params: Promise.resolve({ artifact: "unknown.jsonl" })
  });
  assert.equal(response.status, 404);
  assert.equal(datasetReleaseCacheStats().entries, before.entries, "unknown artifacts do not reconstruct a release");
  assert.equal(datasetReleaseCacheStats().active, 0);
  const snapshot = await snapshotRoute.GET(new Request("https://eduaipolicy.org/api/public/v1/datasets/release-snapshots/unknown/unknown"), {
    params: Promise.resolve({ releaseId: "unknown", artifact: "unknown" })
  });
  assert.equal(snapshot.status, 404);
});

test("published artifact GET keeps exact body, checksum and filename while warm reads share bounded work", { timeout: 150000 }, async () => {
  const [first, second] = await Promise.all([getDatasetRelease(), getDatasetRelease()]);
  assert.equal(first, second, "concurrent current downloads share one verified build");
  const response = await datasetRoute.GET(new Request("https://eduaipolicy.org/api/public/v1/datasets/claims.jsonl"), {
    params: Promise.resolve({ artifact: "claims.jsonl" })
  });
  const content = await response.text();
  const artifact = first.artifactsByPath.get("/api/public/v1/datasets/claims.jsonl")!;
  assert.equal(response.status, 200);
  assert.equal(content, artifact.content);
  assert.equal(response.headers.get("X-Checksum-SHA256"), createHash("sha256").update(content).digest("hex"));
  assert.equal(response.headers.get("Content-Disposition"), `attachment; filename="${artifact.fileName}"`);
  assert.match(response.headers.get("Content-Type")!, /^application\/jsonl/);
  const manifest = await getCurrentPublicReleaseManifest();
  assert.ok(manifest);
  const snapshot = await getDatasetReleaseForPublicManifest(manifest);
  assert.notEqual(snapshot, first, "historical snapshots cannot reuse the current repaired-record projection");
  const historicalResponse = await snapshotRoute.GET(new Request(`https://eduaipolicy.org/api/public/v1/datasets/release-snapshots/${manifest.releaseId}/manifest.json`), {
    params: Promise.resolve({ releaseId: manifest.releaseId, artifact: "manifest.json" })
  });
  assert.equal(historicalResponse.status, 200, "a known historical URL remains reachable on demand");
  const historical = await historicalResponse.json();
  assert.equal(historical.releaseId, manifest.releaseId);
  assert.equal(historical.publishedAt, manifest.publishedAt);
  assert.ok(historical.counts.claims > 0 && historical.counts.sources > 0);
  const missingHistory = await snapshotRoute.GET(new Request("https://eduaipolicy.org/api/public/v1/datasets/release-snapshots/unknown-release/claims.jsonl"), {
    params: Promise.resolve({ releaseId: "unknown-release", artifact: "claims.jsonl" })
  });
  assert.equal(missingHistory.status, 404);
  const stats = datasetReleaseCacheStats();
  assert.ok(stats.entries <= stats.maxEntries && stats.bytes <= stats.maxBytes);
});

test("reports share one historical computation across locales while isolating localized consumers", { timeout: 150000 }, async (context) => {
  const root = await findRepoRoot();
  const manifest = JSON.parse(await readFile(path.join(root, monthlyReportRegistry["2026-05"].releaseManifestPath), "utf8")) as PublicReleaseManifest;
  const artifactRoot = path.resolve(root, manifest.includeStagedArtifactDirectories[0]);
  const reads = mock.method(fs, "readdir");
  syncBuiltinESMExports();
  context.after(() => { reads.mock.restore(); syncBuiltinESMExports(); });
  const before = monthlyReportCacheStats();
  const reports = await Promise.all(["en", "ar", "ja"].map(locale => getMonthlyReport("2026-05", locale)));
  const [first, arabic, japanese] = reports;
  assert.ok(first && arabic && japanese);
  const historicalWalks = () => reads.mock.calls.filter(call => path.resolve(String(call.arguments[0])) === artifactRoot).length;
  assert.equal(historicalWalks(), 1, "concurrent languages share the actual frozen input traversal");
  assert.equal(monthlyReportCacheStats().entries, before.entries + 1, "one retained fact entry serves all three locales");
  assert.deepEqual(arabic.metrics, first.metrics);
  assert.deepEqual(japanese.coverageSummary, first.coverageSummary);
  assert.equal(arabic.metricCards[0].value, first.metrics.publicUniversityCount.toLocaleString("ar"));
  assert.equal(japanese.metricCards[0].value, first.metrics.publicUniversityCount.toLocaleString("ja"));
  assert.ok(arabic.geoAnswerBlocks.find(block => block.id === "release-size")!.answer.includes(first.metrics.claimCount.toLocaleString("ar")));
  assert.ok(arabic.summaryBullets.some(bullet => bullet.startsWith(`${first.metrics.checkedInstitutionCount.toLocaleString("ar")} public university records`)));
  const original = first.coverageRows[0]?.name;
  const originalClaims = first.metrics.claimCount;
  if (first.coverageRows[0]) first.coverageRows[0].name = "consumer-only mutation";
  first.metrics.claimCount = -1;
  first.summaryBullets.push("consumer-only bullet");
  const second = await getMonthlyReport("2026-05", "en");
  assert.ok(second);
  assert.notEqual(first, second);
  assert.equal(second.coverageRows[0]?.name, original);
  assert.equal(arabic.coverageRows[0]?.name, original);
  assert.equal(second.metrics.claimCount, originalClaims);
  assert.equal(arabic.metrics.claimCount, originalClaims);
  assert.ok(!second.summaryBullets.includes("consumer-only bullet"));
  const french = await getMonthlyReport("2026-05", "fr");
  assert.ok(french);
  assert.equal(french.metricCards[0].value, french.metrics.publicUniversityCount.toLocaleString("fr"));
  assert.equal(french.releaseId, second.releaseId);
  assert.equal(french.metrics.claimCount, second.metrics.claimCount);
  assert.equal(historicalWalks(), 1, "later locale and warm reads do not reload the historical facts");
  const stats = monthlyReportCacheStats();
  assert.ok(stats.entries <= stats.maxEntries && stats.bytes <= stats.maxBytes);
  assert.equal(stats.maxEntries, 12);
  assert.equal(stats.maxBytes, 12 * 1024 * 1024);
  assert.equal(await getMonthlyReport("not-a-published-month", "en"), undefined);
});

test("warm current downloads do not replace earlier report or claim snapshot contents", { timeout: 150000 }, async () => {
  await getDatasetRelease();
  const root = await findRepoRoot();
  const identities = [];
  for (const month of ["2026-05", "2026-06"] as const) {
    const manifest = JSON.parse(await readFile(path.join(root, monthlyReportRegistry[month].releaseManifestPath), "utf8")) as PublicReleaseManifest;
    const expected = await getStagedPublicDatasetForManifest(manifest);
    const expectedClaims = expected.publicSummaries.flatMap(summary => summary.claims.map(claim => ({
      slug: summary.entity.slug,
      text: claim.claimText,
      evidence: claim.evidence.map(item => item.evidenceSnippet)
    })));
    const report = await getMonthlyReport(month, "en");
    assert.ok(report);
    assert.equal(report.releaseId, manifest.releaseId);
    assert.equal(report.publishedAt, manifest.publishedAt);
    assert.equal(report.metrics.publicUniversityCount, expected.publicSummaries.length);
    assert.equal(report.metrics.claimCount, expectedClaims.length);
    identities.push({ release: report.releaseId, claims: report.metrics.claimCount });

    const response = await snapshotRoute.GET(new Request(`https://eduaipolicy.org/api/public/v1/datasets/release-snapshots/${manifest.releaseId}/claims.jsonl`), {
      params: Promise.resolve({ releaseId: manifest.releaseId, artifact: "claims.jsonl" })
    });
    assert.equal(response.status, 200);
    const rows = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
    assert.ok(rows.every(row => row.releaseId === manifest.releaseId));
    assert.deepEqual(rows.map(row => ({ slug: row.entitySlug, text: row.claimText, evidence: row.evidence.map((item: { evidenceSnippet: string }) => item.evidenceSnippet) })), expectedClaims);
  }
  assert.notEqual(identities[0].release, identities[1].release);
  assert.notEqual(identities[0].claims, identities[1].claims, "the regression exercises distinct historical datasets");
});

test("the complete report index finishes without constructing historical download artifacts", { timeout: 30000 }, async () => {
  const before = datasetReleaseCacheStats();
  const reports = await getReportsIndex("ja");
  assert.deepEqual(reports.map(report => report.slug).sort(), [...monthlyReportSlugs].sort());
  assert.ok(reports.every(report => report.metrics.claimCount > 0 && report.releaseId && report.coverageRows.length > 0));
  assert.deepEqual(datasetReleaseCacheStats(), before, "report counts do not materialize the six full export files for every historical month");
  assert.ok(reports.every((report, index) => index === 0 || report.publishedAt <= reports[index - 1].publishedAt));
  const again = await getReportsIndex("ja");
  assert.deepEqual(again.map(report => ({ slug: report.slug, releaseId: report.releaseId, metrics: report.metrics })), reports.map(report => ({ slug: report.slug, releaseId: report.releaseId, metrics: report.metrics })));
  assert.deepEqual(datasetReleaseCacheStats(), before);
});
