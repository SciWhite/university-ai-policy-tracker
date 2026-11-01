import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateReadingTranslationBundle, getReadingTranslations, readingTranslation, readingMetadata, readingSummaryView, readingSummaryBasis, readingDisplayView, type ReadingTranslationBundle } from "../apps/web/lib/reading-translations";
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
    assert.throws(() => validateReadingTranslationBundle(invalid, invalid), /numeric facts|protected tokens/);
  }
  const facts = "Rule 19 and 20; 12.50 per month; 2026-10-28.";
  for (const target of [facts.replace("19", "18"), facts.replace("20", "twenty"), facts.replace("12.50", "12.00")]) {
    const invalid = displayPair(facts, target);
    assert.throws(() => validateReadingTranslationBundle(invalid, invalid), /numeric facts/);
  }
  const changedDate = displayPair(facts, facts.replace("2026-10-28", "2026-10-29"));
  assert.throws(() => validateReadingTranslationBundle(changedDate, changedDate), /numeric facts|protected tokens/);
});
test("sampled status enums and frozen brand lexicon are narrowly hash-bound", () => {
  const source = "Derived availability: conditionally allowed.";
  const translation = "Synthetic status: conditionally_allowed.";
  const value = displayPair(source, translation);
  const marker = { locale: value.locale, sourceSha256: sha(source), targetSha256: sha(translation), marker: "conditionally_allowed" };
  assert.throws(() => validateReadingTranslationBundle(value, value), /added protected marker/);
  assert.doesNotThrow(() => validateReadingTranslationBundle(value, value, { statusEnumExceptions: [marker] }));
  assert.throws(() => validateReadingTranslationBundle(value, value, { statusEnumExceptions: [{ ...marker, targetSha256: "f".repeat(64) }] }), /added protected marker/);

  const productSource = "Microsoft Copilot for Microsoft 365 is available.";
  const productTarget = "Microsoft 365 Copilot for Microsoft 365 उपलब्ध है.";
  const product = displayPair(productSource, productTarget);
  assert.throws(() => validateReadingTranslationBundle(product, product), /numeric facts/);
  assert.doesNotThrow(() => validateReadingTranslationBundle(product, product, { matchAcceptedBrandVocabulary: true }));
  for (const [numericSource, numericTarget] of [
    ["365 days are allowed.", "366 days are allowed."],
    ["Checked on 2026-10-28.", "Checked on 2026-10-29."],
    ["Microsoft 365 Copilot supports 365 days.", "Microsoft 365 Copilot supports 366 days."]
  ]) {
    const invalid = displayPair(numericSource, numericTarget);
    assert.throws(() => validateReadingTranslationBundle(invalid, invalid, { matchAcceptedBrandVocabulary: true }), /protected tokens|numeric facts/);
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
test("production approved selections cannot use forged sampled marker exceptions", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "uapt-reading-forged-enum-"));
  const previousEnv = process.env.NODE_ENV;
  try {
    const school = bundle(), shared = bundle("_shared"), basis = { recordSha256: school.recordSha256, originalEvidenceSha256: school.originalEvidenceSha256 };
    const unit = Object.values(school.strings)[0];
    unit.translation += " conditionally_allowed";
    const put = async (name: string, value: unknown) => { const bytes = JSON.stringify(value); await writeFile(path.join(root, name), bytes); return { path: name, sha256: sha(bytes) }; };
    const targetSha256 = sha(unit.translation);
    const selection = {
      schemaVersion: "uapt-reading-selection-v1", revision: "forged-production-exception", sourceSha256: school.sourceSha256,
      publicationApproved: true,
      samplingAcceptance: { schemaVersion: "uapt-translation-sampling-acceptance-v1", sourceSha256: school.sourceSha256, matrixSha256: "e".repeat(64), acceptanceSha256: "f".repeat(64), targetPairs: 1, randomConfirmationSize: 1, confirmedErrorsBeforeCorrection: 0, oneSidedUpperBound: 0, fullCorpusSemanticReview: false, nativeSpeakerApproval: false, statusEnumExceptions: [{ locale: "ar", sourceSha256: unit.sourceSha256, targetSha256, marker: "conditionally_allowed" }] },
      shared: { ar: await put("shared.json", shared) }, schools: { ucl: { ar: await put("school.json", school) } },
    };
    const selectionRef = await put("selection.json", selection), pointer = path.join(root, "candidate.json");
    await writeFile(pointer, JSON.stringify(selectionRef));
    process.env.NODE_ENV = "production";
    assert.equal((await getReadingTranslations("ucl", "ar", basis, pointer)).state, "invalid_package");
  } finally {
    if (previousEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnv;
    await rm(root, { recursive: true, force: true });
  }
});
test("an explicitly approved sampled-package contract can load its exact target in production", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "uapt-reading-sampled-publication-"));
  const keys = ["NODE_ENV", "NEXT_PUBLIC_SITE_URL", "UAPT_LOCAL_READING_CANDIDATE_ACCEPTANCE_SHA256", "UAPT_LOCAL_READING_CANDIDATE_SELECTION_SHA256", "UAPT_READING_SAMPLED_PUBLICATION_ACCEPTANCE_SHA256", "UAPT_READING_SAMPLED_PUBLICATION_SELECTION_SHA256", "UAPT_READING_PACKAGE_POINTER"] as const;
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://eduaipolicy.org";
    const summary = {
      entity: { type: "university", slug: "ucl", name: "UCL", canonicalUrl: "https://eduaipolicy.org/universities/ucl" },
      canonicalUrl: "https://eduaipolicy.org/universities/ucl", publicPageUrl: "https://eduaipolicy.org/universities/ucl",
      apiUrl: "https://eduaipolicy.org/api/public/v1/universities/ucl.json", suggestedCitation: "UAPT. https://eduaipolicy.org/universities/ucl",
      summary: "A frozen summary.", claims: [{ id: "claim-ucl-001", claimText: "Frozen claim.", evidence: [] }]
    } as unknown as PublicEntitySummary;
    const basis = readingSummaryBasis(summary), source = "Derived availability: conditionally allowed.", target = "الحالة: conditionally_allowed بالفعل.";
    const school = bundle(), shared = bundle("_shared");
    school.recordSha256 = basis.recordSha256; school.originalEvidenceSha256 = basis.originalEvidenceSha256;
    school.requiredSourceHashes = [sha(source)];
    school.strings = { [sha(source)]: { source, sourceSha256: sha(source), translation: target } };
    const exception = { locale: "ar" as const, sourceSha256: sha(source), targetSha256: sha(target), marker: "conditionally_allowed" };
    const adjustmentSha256 = sha(JSON.stringify({ statusEnumExceptions: [exception], urlBoundaryRepairs: [] }));
    const samplingAcceptance = { schemaVersion: "uapt-translation-sampling-acceptance-v1" as const, sourceSha256: school.sourceSha256, matrixSha256: "e".repeat(64), acceptanceSha256: "f".repeat(64), targetPairs: 538624, randomConfirmationSize: 2000, confirmedErrorsBeforeCorrection: 14, oneSidedUpperBound: 0.011717, fullCorpusSemanticReview: false as const, nativeSpeakerApproval: false as const, statusEnumExceptions: [exception], urlBoundaryRepairs: [], packageAdjustmentSha256: adjustmentSha256 };
    process.env.UAPT_READING_SAMPLED_PUBLICATION_ACCEPTANCE_SHA256 = samplingAcceptance.acceptanceSha256;
    const put = async (name: string, value: unknown) => { const bytes = JSON.stringify(value); await writeFile(path.join(root, name), bytes); return { path: name, sha256: sha(bytes) }; };
    const selection = {
      schemaVersion: "uapt-reading-selection-v1", revision: "synthetic-approved-sample", sourceSha256: school.sourceSha256,
      publicationApproved: true, samplingAcceptance,
      sampledPublicationAcceptance: { schemaVersion: "uapt-reviewed-sampled-translation-publication-v1", status: "approved", sourceSha256: school.sourceSha256, matrixSha256: samplingAcceptance.matrixSha256, acceptanceSha256: samplingAcceptance.acceptanceSha256, packageAdjustmentSha256: adjustmentSha256, targetPairs: samplingAcceptance.targetPairs, publicationApproved: true },
      shared: { ar: await put("shared.json", shared) }, schools: { ucl: { ar: await put("school.json", school) } },
    };
    const selectionRef = await put("selection.json", selection), pointer = path.join(root, "candidate.json");
    await writeFile(pointer, JSON.stringify(selectionRef));
    process.env.UAPT_READING_PACKAGE_POINTER = pointer;
    process.env.UAPT_READING_SAMPLED_PUBLICATION_SELECTION_SHA256 = selectionRef.sha256;
    const result = await getReadingTranslations("ucl", "ar", basis, pointer);
    assert.equal(result.state, "ready");
    if (result.state === "ready") assert.deepEqual(readingTranslation(source, [result.school, result.shared]), { text: target, translated: true });
    process.env.UAPT_READING_SAMPLED_PUBLICATION_ACCEPTANCE_SHA256 = "0".repeat(64);
    assert.equal((await getReadingTranslations("ucl", "ar", basis, pointer)).state, "unapproved");
  } finally {
    for (const key of keys) before[key] === undefined ? delete process.env[key] : process.env[key] = before[key];
    await rm(root, { recursive: true, force: true });
  }
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
test("record basis preserves exact site-origin fields in dev and production", () => {
  const summary = {
    entity: { type: "university", slug: "ucl", name: "UCL", canonicalUrl: "http://localhost:3000/universities/ucl" },
    canonicalUrl: "http://localhost:3000/universities/ucl",
    publicPageUrl: "http://localhost:3000/universities/ucl",
    apiUrl: "http://localhost:3000/api/public/v1/universities/ucl.json",
    suggestedCitation: "UAPT. http://localhost:3000/universities/ucl",
    summary: "A frozen summary.",
    claims: [{ id: "claim-ucl-001", reviewState: "agent_reviewed", claimText: "Frozen claim.", evidence: [{ id: "ev-ucl-001", sourceUrl: "https://ucl.ac.uk/policy", sourceSnapshotHash: "a".repeat(64), evidenceSnippet: "Original quote." }] }]
  } as unknown as PublicEntitySummary;
  const keys = ["NODE_ENV", "UAPT_LOCAL_READING_CANDIDATE_SELECTION_SHA256", "UAPT_LOCAL_READING_CANDIDATE_ACCEPTANCE_SHA256", "UAPT_READING_SAMPLED_PUBLICATION_ACCEPTANCE_SHA256", "UAPT_READING_SAMPLED_PUBLICATION_SELECTION_SHA256", "UAPT_READING_PACKAGE_POINTER", "NEXT_PUBLIC_SITE_URL"] as const;
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    process.env.NODE_ENV = "development";
    process.env.UAPT_LOCAL_READING_CANDIDATE_SELECTION_SHA256 = "b".repeat(64);
    process.env.UAPT_LOCAL_READING_CANDIDATE_ACCEPTANCE_SHA256 = "c".repeat(64);
    process.env.NEXT_PUBLIC_SITE_URL = "https://eduaipolicy.org";
    const qa = structuredClone(summary);
    qa.canonicalUrl = "https://eduaipolicy.org/universities/ucl";
    qa.publicPageUrl = qa.canonicalUrl;
    qa.apiUrl = "https://eduaipolicy.org/api/public/v1/universities/ucl.json";
    qa.entity.canonicalUrl = qa.canonicalUrl;
    qa.suggestedCitation = "UAPT. https://eduaipolicy.org/universities/ucl";
    assert.notDeepEqual(readingSummaryBasis(qa), readingSummaryBasis(summary));
    const changedReview = structuredClone(qa);
    changedReview.claims[0].reviewState = "held";
    assert.notDeepEqual(readingSummaryBasis(changedReview), readingSummaryBasis(summary));
    const changedPath = structuredClone(qa);
    changedPath.apiUrl = "https://eduaipolicy.org/api/public/v1/universities/other.json";
    assert.notDeepEqual(readingSummaryBasis(changedPath), readingSummaryBasis(summary));
    process.env.NODE_ENV = "production";
    assert.notDeepEqual(readingSummaryBasis(qa), readingSummaryBasis(summary));
    process.env.UAPT_READING_SAMPLED_PUBLICATION_ACCEPTANCE_SHA256 = "f".repeat(64);
    assert.notDeepEqual(readingSummaryBasis(qa), readingSummaryBasis(summary));
    const wrongOriginPath = structuredClone(qa);
    wrongOriginPath.canonicalUrl = "https://eduaipolicy.org/universities/other";
    assert.notDeepEqual(readingSummaryBasis(wrongOriginPath), readingSummaryBasis(summary));
    process.env.NEXT_PUBLIC_SITE_URL = "https://other.example";
    assert.notDeepEqual(readingSummaryBasis(qa), readingSummaryBasis(summary));
  } finally {
    for (const key of keys) before[key] === undefined ? delete process.env[key] : process.env[key] = before[key];
  }
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
test("V6 display translation includes topic titles while preserving evidence titles and source quotations", () => {
  const value = bundle(), sources = ["Coursework", "A reviewed summary."];
  value.requiredSourceHashes = sources.map(sha);
  value.strings = Object.fromEntries(sources.map((source, index) => [sha(source), { source, sourceSha256: sha(source), translation: ["学习作业", "已审阅摘要。"].at(index)! }]));
  const input = { topics: [{ title: "Coursework", summary: "A reviewed summary.", summaryLanguage: "en", claims: [{ id: "claim-ucl-001", title: "Official policy page", text: "Original quotation", evidence: [{ title: "Official policy page", quote: "Original quotation", language: "en", url: "https://example.edu/policy" }] }] }] };
  const view = readingDisplayView(input, { state: "ready", revision: "synthetic", shared: bundle("_shared"), school: value }, "zh-Hant");
  assert.equal(view.topics[0].title, "学习作业");
  assert.equal(view.topics[0].summary, "已审阅摘要。");
  assert.equal(view.topics[0].summaryLanguage, "zh-Hant");
  assert.equal(view.topics[0].claims[0].title, "Official policy page");
  assert.equal(view.topics[0].claims[0].evidence[0].quote, "Original quotation");
  assert.equal(view.topics[0].claims[0].evidence[0].title, "Official policy page");
});
