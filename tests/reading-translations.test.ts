import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateReadingTranslationBundle, getReadingTranslations, readingTranslation, readingMetadata, readingSummaryView, type ReadingTranslationBundle } from "../apps/web/lib/reading-translations";
import type { PublicEntitySummary } from "@uapt/shared";
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
// Synthetic fixtures verify transport/invariants only, never translation quality.
function bundle(slug = "ucl"): ReadingTranslationBundle {
  const source = "Test display {name} conditionally_allowed";
  return { schemaVersion: "uapt-reading-translations-v1", sourceSha256: "a".repeat(64), locale: "ar", slug, recordSha256: "b".repeat(64), originalEvidenceSha256: "c".repeat(64), review: { status: "accepted", receiptSha256: "d".repeat(64) }, protectedClaimIds: [], requiredSourceHashes: [sha(source)], strings: { [sha(source)]: { source, sourceSha256: sha(source), translation: "Synthetic fixture {name} conditionally_allowed" } } };
}
function displayPair(source: string, translation: string, claimIds: string[] = []) {
  const value = bundle();
  value.protectedClaimIds = claimIds;
  value.requiredSourceHashes = [sha(source)];
  value.strings = { [sha(source)]: { source, sourceSha256: sha(source), translation } };
  return value;
}
test("reviewed word-number rendering may add a digit while existing numeric facts stay exact", () => {
  const value = displayPair("Three scenarios with 2 conditions.", "Synthetic fixture: 3 scenarios with 2 conditions.");
  assert.doesNotThrow(() => validateReadingTranslationBundle(value, value));
  for (const target of ["Fixture: 3 conditions.", "Fixture: 2 conditions plus 2.", "Fixture without a count."]) {
    const invalid = displayPair("Two scenarios with 2 conditions.", target);
    assert.throws(() => validateReadingTranslationBundle(invalid, invalid), /numeric facts/);
  }
  const facts = "Rule 19 and 20; 12.50 per month; 2026-10-28.";
  for (const target of [facts.replace("19", "18"), facts.replace("20", "twenty"), facts.replace("12.50", "12.00"), facts.replace("2026-10-28", "2026-10-29")]) {
    const invalid = displayPair(facts, target);
    assert.throws(() => validateReadingTranslationBundle(invalid, invalid), /numeric facts/);
  }
});
test("frozen Claim IDs remain exact while ordinary claim-level prose can be localized", () => {
  const source = "Use claim-level guidance for claim-ucl-001 and cl-ucl-record-a.";
  const value = displayPair(source, "Synthetic guidance: claim-ucl-001; cl-ucl-record-a.", ["claim-ucl-001", "cl-ucl-record-a"]);
  assert.doesNotThrow(() => validateReadingTranslationBundle(value, value));
  for (const target of ["Fixture claim-ucl-002; cl-ucl-record-a.", "Fixture claim-ucl-001 twice claim-ucl-001; cl-ucl-record-a.", "Fixture claim-ucl-001."]) {
    const invalid = displayPair(source, target, value.protectedClaimIds);
    assert.throws(() => validateReadingTranslationBundle(invalid, invalid), /protected Claim ID/);
  }
  const invalid = { ...value, protectedClaimIds: undefined } as unknown as ReadingTranslationBundle;
  assert.throws(() => validateReadingTranslationBundle(invalid, value), /Claim inventory/);
});
test("only complete, reviewed exact source strings enter a display bundle", () => {
  const value = bundle(), expected = { sourceSha256: value.sourceSha256, locale: value.locale, slug: value.slug };
  assert.doesNotThrow(() => validateReadingTranslationBundle(value, expected));
  assert.equal(readingTranslation(Object.values(value.strings)[0].source, [value]).translated, true);
  assert.deepEqual(readingTranslation("Unknown source", [value]), { text: "Unknown source", translated: false });
  const missing = structuredClone(value); missing.requiredSourceHashes.push("e".repeat(64));
  assert.throws(() => validateReadingTranslationBundle(missing, expected), /Incomplete/);
  const changed = structuredClone(value); Object.values(changed.strings)[0].translation = "Dropped markers";
  assert.throws(() => validateReadingTranslationBundle(changed, expected), /protected/);
  const stale = structuredClone(value); Object.values(stale.strings)[0].source += "changed";
  assert.throws(() => validateReadingTranslationBundle(stale, expected), /source/);
});
test("production reader excludes unapproved candidates and stale policy/evidence bases", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "uapt-reading-"));
  const school = bundle(), shared = bundle("_shared"), basis = { recordSha256: school.recordSha256, originalEvidenceSha256: school.originalEvidenceSha256 };
  async function file(name: string, value: unknown) { const text = JSON.stringify(value); await writeFile(path.join(root, name), text); return { path: name, sha256: sha(text) }; }
  const selection = { schemaVersion: "uapt-reading-selection-v1", revision: "test", sourceSha256: school.sourceSha256, publicationApproved: false, shared: { ar: await file("shared.json", shared) }, schools: { ucl: { ar: await file("school.json", school) } } };
  const pointer = path.join(root, "current.json");
  const save = async () => writeFile(pointer, JSON.stringify(await file("selection.json", selection)));
  try {
    await save(); assert.equal((await getReadingTranslations("ucl", "ar", basis, pointer)).state, "unapproved");
    selection.publicationApproved = true; await save();
    assert.equal((await getReadingTranslations("ucl", "ar", basis, pointer)).state, "ready");
    assert.equal((await getReadingTranslations("ucl", "ar", { ...basis, recordSha256: "e".repeat(64) }, pointer)).state, "stale_record");
    assert.equal((await getReadingTranslations("ucl", "ar", { ...basis, originalEvidenceSha256: "e".repeat(64) }, pointer)).state, "stale_record");
    assert.equal((await getReadingTranslations("ucl", "ko", basis, pointer)).state, "unavailable");
    await writeFile(path.join(root, "school.json"), "{}");
    assert.equal((await getReadingTranslations("ucl", "ar", basis, pointer)).state, "invalid_package");
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("reading variants self-canonicalize while noindex remains crawlable and lacks alternates", () => {
  const metadata = readingMetadata("/universities/ucl", "ar", ["en", "zh"], "https://eduaipolicy.org", true);
  assert.equal(metadata.alternates.canonical, "https://eduaipolicy.org/ar/universities/ucl");
  assert.deepEqual(metadata.robots, { index: false, follow: true });
  assert.deepEqual(metadata.alternates.languages, {});
  const eligible = readingMetadata("/universities/ucl", "zh", ["en", "zh"], "https://eduaipolicy.org", true);
  assert.deepEqual(eligible.alternates.languages, { en: "https://eduaipolicy.org/universities/ucl", zh: "https://eduaipolicy.org/zh/universities/ucl", "x-default": "https://eduaipolicy.org/universities/ucl" });
  assert.equal(readingMetadata("/universities/ucl", "zh", ["en", "zh"], "https://eduaipolicy.org", false).robots.index, false);
});
test("a display record translates prose while keeping original quotations, IDs, dates and held/review state", () => {
  const summary = { summary: "Synthetic summary", claims: [{ id: "claim-test-001", claimText: "Synthetic claim", reviewState: "agent_reviewed", checkedAt: "2026-10-28", evidence: [{ evidenceSnippet: "Original quotation 123", sourceUrl: "https://example.edu/policy", sourceSnapshotHash: "f".repeat(64) }] }], reviewState: "agent_reviewed", lastCheckedAt: "2026-10-28" } as unknown as PublicEntitySummary;
  const before = JSON.stringify(summary), school = bundle();
  school.recordSha256 = sha(before);
  school.originalEvidenceSha256 = sha(JSON.stringify(summary.claims.map(claim => ({ id: claim.id, evidence: claim.evidence }))));
  school.strings = Object.fromEntries([summary.summary, summary.claims[0].claimText].map(source => [sha(source), { source, sourceSha256: sha(source), translation: "Synthetic accepted target" }]));
  school.requiredSourceHashes = Object.keys(school.strings);
  const display = readingSummaryView(summary, { state: "ready", revision: "synthetic", shared: bundle("_shared"), school });
  assert.equal(JSON.stringify(summary), before);
  assert.equal(display.claims[0].evidence, summary.claims[0].evidence);
  assert.equal(display.claims[0].id, summary.claims[0].id);
  assert.equal(display.claims[0].reviewState, summary.claims[0].reviewState);
  assert.equal(display.lastCheckedAt, summary.lastCheckedAt);
  assert.equal(display.claims[0].claimText, "Synthetic accepted target");
  delete school.strings[sha(summary.summary)];
  assert.throws(() => readingSummaryView(summary, { state: "ready", revision: "synthetic", shared: bundle("_shared"), school }), /translation missing/);
});
