import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  checkReadingTranslationDelta, getReadingTranslations, isVerifiedReadingBundle,
  type ReadingDeltaReviewReceipt, type ReadingRecordDelta, type ReadingTranslationBundle, type ReadingTranslationDelta, type ReadingTranslationSelection
} from "../apps/web/lib/reading-translations";
import { readingDisplayRequirementsComplete } from "../apps/web/lib/university-reading-metadata";
import { localeIndexPolicySelection, readingPackageSelection, resetContentRuntimeForTests, CONTENT_API_VERSION } from "../apps/web/lib/content-runtime";

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const unit = (source: string, translation: string) => ({ source, sourceSha256: sha(source), translation });
const OLD = { recordSha256: "b".repeat(64), originalEvidenceSha256: "c".repeat(64) };
const NEW = { recordSha256: "1".repeat(64), originalEvidenceSha256: "2".repeat(64) };
const NEWER = { recordSha256: "3".repeat(64), originalEvidenceSha256: "4".repeat(64) };
const CORPUS = "a".repeat(64);
const SUMMARY = "Policy overview", CLAIM = "Students must disclose AI use.", CORRECTED = "Students must disclose AI use in writing from 2027.";

/**
 * A published package with one school bundle bound to the old record, plus a
 * record delta that adds the corrected claim and moves the basis to NEW.
 */
function fixture(options: { mutateDelta?: (delta: ReadingTranslationDelta) => void; mutateReceipt?: (receipt: ReadingDeltaReviewReceipt) => void; deltaSlug?: string } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), "uapt-record-delta-"));
  const put = (name: string, value: unknown) => {
    const bytes = JSON.stringify(value);
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFileSync(path.join(root, name), bytes);
    return { path: name, sha256: sha(bytes) };
  };
  const bundle = (slug: string, strings: ReturnType<typeof unit>[], uses: Record<string, string[]>): ReadingTranslationBundle => ({
    schemaVersion: "uapt-reading-translations-v1", sourceSha256: CORPUS, locale: "ar", slug, ...OLD,
    review: { status: "accepted", receiptSha256: "d".repeat(64) }, protectedClaimIds: [],
    requiredSourceHashes: strings.map(s => s.sourceSha256), strings: Object.fromEntries(strings.map(s => [s.sourceSha256, s])), sourceFieldUses: uses
  });
  const shared = bundle("_shared", [unit("Overview", "نظرة عامة")], {});
  const school = bundle("ucl", [unit(SUMMARY, "ملخص السياسة"), unit(CLAIM, "يجب على الطلاب الإفصاح عن استخدام الذكاء الاصطناعي.")],
    { [sha(SUMMARY)]: ["/public/summary"], [sha(CLAIM)]: ["/public/claims/c1/claimText"] });
  const base: ReadingTranslationSelection = { schemaVersion: "uapt-reading-selection-v1", revision: "base", sourceSha256: CORPUS, publicationApproved: true,
    shared: { ar: put("shared.json", shared) }, schools: { ucl: { ar: put("school.json", school) } } };
  const baseRef = put("selection-base.json", base);
  writeFileSync(path.join(root, "base.json"), JSON.stringify(baseRef));

  const translation = "يجب على الطلاب الإفصاح كتابيًا عن استخدام الذكاء الاصطناعي اعتبارًا من 2027.";
  const delta: ReadingTranslationDelta = { schemaVersion: "uapt-reading-translation-delta-v1", revision: "fix-1", corpusSourceSha256: CORPUS, locale: "ar", slug: options.deltaSlug ?? "ucl",
    parent: OLD, record: NEW, protectedClaimIds: ["c1"],
    strings: { [sha(CORRECTED)]: unit(CORRECTED, translation) },
    // The unchanged summary also appears in a new field of the corrected page.
    sourceFieldUses: { [sha(CORRECTED)]: ["/public/claims/c1/claimText"], [sha(SUMMARY)]: ["/v6/schools/0/topics/0/summary"] } };
  options.mutateDelta?.(delta);
  const receipt: ReadingDeltaReviewReceipt = { schemaVersion: "uapt-reading-delta-review-v1", status: "accepted", revision: "fix-1", parentSelectionSha256: baseRef.sha256, corpusSourceSha256: CORPUS,
    translator: { id: "translator-run-1", method: "machine translation + validator" }, reviewer: { id: "reviewer-run-2", method: "independent bilingual review of every pair" },
    reviewedAt: "2026-11-06T00:00:00.000Z", coverage: "every_delta_pair", nativeSpeakerApproval: false, publicationApproved: false,
    pairs: [
      { slug: "ucl", locale: "ar", sourceSha256: sha(CORRECTED), targetSha256: sha(translation), fieldUses: ["/public/claims/c1/claimText"], origin: "new_translation", verdict: "accepted" },
      { slug: "ucl", locale: "ar", sourceSha256: sha(SUMMARY), targetSha256: sha("ملخص السياسة"), fieldUses: ["/v6/schools/0/topics/0/summary"], origin: "field_use_addition", verdict: "accepted" }
    ] };
  options.mutateReceipt?.(receipt);
  const receiptRef = put("record-deltas/fix-1/review.json", receipt);
  const recordDelta: ReadingRecordDelta = { schemaVersion: "uapt-reading-record-delta-v1", revision: "fix-1", parentSelectionSha256: baseRef.sha256, receipt: receiptRef,
    schools: { ucl: { parent: OLD, record: NEW, locales: { ar: put("record-deltas/fix-1/ar/ucl.json", delta) } } } };
  const next: ReadingTranslationSelection = { ...base, revision: "fix-1", supplemental: { recordDeltas: [recordDelta] } };
  const nextRef = put("selection-fix-1.json", next);
  writeFileSync(path.join(root, "current.json"), JSON.stringify(nextRef));
  return { root, pointer: path.join(root, "current.json"), basePointer: path.join(root, "base.json"), receiptSha256: receiptRef.sha256, put, next, recordDelta, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function withPins<T>(pins: string, fn: () => Promise<T>): Promise<T> {
  const saved = { pins: process.env.UAPT_READING_RECORD_DELTA_ACCEPTANCE_SHA256S, root: process.env.UAPT_CONTENT_ROOT };
  process.env.UAPT_READING_RECORD_DELTA_ACCEPTANCE_SHA256S = pins;
  delete process.env.UAPT_CONTENT_ROOT;
  resetContentRuntimeForTests();
  return fn().finally(() => {
    if (saved.pins === undefined) delete process.env.UAPT_READING_RECORD_DELTA_ACCEPTANCE_SHA256S; else process.env.UAPT_READING_RECORD_DELTA_ACCEPTANCE_SHA256S = saved.pins;
    if (saved.root !== undefined) process.env.UAPT_CONTENT_ROOT = saved.root;
    resetContentRuntimeForTests();
  });
}

test("a corrected record reuses its accepted bundle and needs only the reviewed delta strings", async () => {
  const f = fixture();
  try {
    await withPins(f.receiptSha256, async () => {
      // Without the delta the school is stale; with it, unchanged strings keep their old translations.
      assert.equal((await getReadingTranslations("ucl", "ar", NEW, f.basePointer)).state, "stale_record");
      const result = await getReadingTranslations("ucl", "ar", NEW, f.pointer);
      assert.equal(result.state, "ready");
      if (result.state !== "ready") return;
      assert.equal(result.school.recordSha256, NEW.recordSha256);
      assert.equal(result.school.strings[sha(SUMMARY)].translation, "ملخص السياسة");
      assert.match(result.school.strings[sha(CORRECTED)].translation, /2027/);
      assert.equal(isVerifiedReadingBundle(result.school), true);
      assert.equal(readingDisplayRequirementsComplete([
        { source: SUMMARY, field: "/v6/schools/0/topics/0/summary" }, { source: CORRECTED, field: "/public/claims/c1/claimText" }
      ], result.school, result.shared), true);
      const again = await getReadingTranslations("ucl", "ar", NEW, f.pointer);
      assert.equal(again.state === "ready" && again.school, result.school, "the composed view keeps one identity");
      // Rollback: the parent selection still serves the old record exactly as before.
      const old = await getReadingTranslations("ucl", "ar", OLD, f.basePointer);
      assert.equal(old.state, "ready");
      assert.equal(old.state === "ready" && old.school.strings[sha(CORRECTED)], undefined);
    });
  } finally { f.cleanup(); }
});

test("the release must pin the delta review", async () => {
  const f = fixture();
  try {
    await withPins("", async () => assert.equal((await getReadingTranslations("ucl", "ar", NEW, f.pointer)).state, "unapproved"));
    await withPins("0".repeat(64), async () => assert.equal((await getReadingTranslations("ucl", "ar", NEW, f.pointer)).state, "unapproved"));
  } finally { f.cleanup(); }
});

test("tampered, unreviewed, self-reviewed or misdirected deltas are rejected", async () => {
  const cases: [string, Parameters<typeof fixture>[0], string][] = [
    ["a reviewed pair whose target differs", { mutateReceipt: r => { r.pairs[0].targetSha256 = "9".repeat(64); } }, "unapproved"],
    ["an extra string outside the review", { mutateDelta: d => { const extra = unit("Another new sentence.", "جملة جديدة أخرى."); d.strings[extra.sourceSha256] = extra; d.sourceFieldUses[extra.sourceSha256] = ["/public/claims/c2/claimText"]; } }, "unapproved"],
    ["a field use the reviewer did not see", { mutateDelta: d => { d.sourceFieldUses[sha(CORRECTED)].push("/v6/studentActions/claims/c1/text"); } }, "unapproved"],
    ["a review by the translator", { mutateReceipt: r => { r.reviewer.id = r.translator.id; } }, "unapproved"],
    ["a sampled review", { mutateReceipt: r => { (r as { coverage: string }).coverage = "sampled"; } }, "unapproved"],
    ["a receipt listing pairs outside the delta", { mutateReceipt: r => { r.pairs.push({ ...r.pairs[0], sourceSha256: "8".repeat(64) }); } }, "unapproved"],
    ["a delta for another school", { deltaSlug: "kcl" }, "invalid_package"],
    ["a translation that changes a number", { mutateDelta: d => { d.strings[sha(CORRECTED)].translation = "يجب على الطلاب الإفصاح كتابيًا اعتبارًا من 2028."; }, mutateReceipt: r => { r.pairs[0].targetSha256 = sha("يجب على الطلاب الإفصاح كتابيًا اعتبارًا من 2028."); } }, "invalid_package"]
  ];
  for (const [name, options, expected] of cases) {
    const f = fixture(options);
    try {
      await withPins(f.receiptSha256, async () => assert.equal((await getReadingTranslations("ucl", "ar", NEW, f.pointer)).state, expected, name));
    } finally { f.cleanup(); }
  }
});

test("record deltas chain: a second correction builds on the first without rewriting either", async () => {
  const f = fixture();
  try {
    const later = "Students must disclose AI use in writing from 2027, including in theses.";
    const translation = "يجب على الطلاب الإفصاح كتابيًا عن استخدام الذكاء الاصطناعي اعتبارًا من 2027، بما في ذلك في الأطروحات.";
    const delta: ReadingTranslationDelta = { schemaVersion: "uapt-reading-translation-delta-v1", revision: "fix-2", corpusSourceSha256: CORPUS, locale: "ar", slug: "ucl", parent: NEW, record: NEWER,
      protectedClaimIds: ["c1"], strings: { [sha(later)]: unit(later, translation) }, sourceFieldUses: { [sha(later)]: ["/public/claims/c1/claimText"] } };
    const parentSha = sha(JSON.stringify(f.next));
    const receipt: ReadingDeltaReviewReceipt = { schemaVersion: "uapt-reading-delta-review-v1", status: "accepted", revision: "fix-2", parentSelectionSha256: parentSha, corpusSourceSha256: CORPUS,
      translator: { id: "t3", method: "mt" }, reviewer: { id: "r4", method: "review" }, reviewedAt: "2026-11-07T00:00:00.000Z", coverage: "every_delta_pair", nativeSpeakerApproval: false, publicationApproved: false,
      pairs: [{ slug: "ucl", locale: "ar", sourceSha256: sha(later), targetSha256: sha(translation), fieldUses: ["/public/claims/c1/claimText"], origin: "new_translation", verdict: "accepted" }] };
    const receiptRef = f.put("record-deltas/fix-2/review.json", receipt);
    const second: ReadingRecordDelta = { schemaVersion: "uapt-reading-record-delta-v1", revision: "fix-2", parentSelectionSha256: parentSha, receipt: receiptRef,
      schools: { ucl: { parent: NEW, record: NEWER, locales: { ar: f.put("record-deltas/fix-2/ar/ucl.json", delta) } } } };
    const ref = f.put("selection-fix-2.json", { ...f.next, revision: "fix-2", supplemental: { recordDeltas: [f.recordDelta, second] } });
    writeFileSync(f.pointer, JSON.stringify(ref));
    await withPins(`${f.receiptSha256},${receiptRef.sha256}`, async () => {
      const result = await getReadingTranslations("ucl", "ar", NEWER, f.pointer);
      assert.equal(result.state, "ready");
      if (result.state !== "ready") return;
      assert.ok(result.school.strings[sha(SUMMARY)] && result.school.strings[sha(CORRECTED)] && result.school.strings[sha(later)]);
      assert.equal((await getReadingTranslations("ucl", "ar", NEW, f.pointer)).state, "ready", "the intermediate record still resolves");
    });
    await withPins(f.receiptSha256, async () => assert.equal((await getReadingTranslations("ucl", "ar", NEWER, f.pointer)).state, "unapproved", "each delta review needs its own pin"));
  } finally { f.cleanup(); }
});

test("checkReadingTranslationDelta explains the first problem", () => {
  const delta: ReadingTranslationDelta = { schemaVersion: "uapt-reading-translation-delta-v1", revision: "r", corpusSourceSha256: CORPUS, locale: "ar", slug: "ucl", parent: OLD, record: NEW,
    protectedClaimIds: [], strings: { [sha(CORRECTED)]: unit(CORRECTED, "ترجمة 2027") }, sourceFieldUses: { [sha(CORRECTED)]: ["/public/claims/c1/claimText"] } };
  const recordDelta: ReadingRecordDelta = { schemaVersion: "uapt-reading-record-delta-v1", revision: "r", parentSelectionSha256: "5".repeat(64), receipt: { path: "x", sha256: "6".repeat(64) },
    schools: { ucl: { parent: OLD, record: NEW, locales: {} } } };
  const receipt: ReadingDeltaReviewReceipt = { schemaVersion: "uapt-reading-delta-review-v1", status: "accepted", revision: "r", parentSelectionSha256: "5".repeat(64), corpusSourceSha256: CORPUS,
    translator: { id: "t", method: "m" }, reviewer: { id: "r", method: "m" }, reviewedAt: "2026-11-06T00:00:00Z", coverage: "every_delta_pair", nativeSpeakerApproval: false, publicationApproved: false, pairs: [] };
  const problem = checkReadingTranslationDelta({ accepted: { strings: {} }, delta, recordDelta, receipt, corpusSourceSha256: CORPUS, slug: "ucl", locale: "ar" });
  assert.equal(problem?.state, "unapproved");
  assert.match(problem?.reason ?? "", /not independently accepted/);
});

test("the locale-index policy and delta pins come from the release, with the environment as fallback", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "uapt-locale-policy-"));
  const saved = { root: process.env.UAPT_CONTENT_ROOT, file: process.env.UAPT_UNIVERSITY_LOCALE_INDEX_POLICY, sha: process.env.UAPT_UNIVERSITY_LOCALE_INDEX_POLICY_SHA256 };
  try {
    process.env.UAPT_UNIVERSITY_LOCALE_INDEX_POLICY = "/env/policy.json";
    process.env.UAPT_UNIVERSITY_LOCALE_INDEX_POLICY_SHA256 = "e".repeat(64);
    const manifest = { schemaVersion: "uapt-content-release-v1", contentId: "demo-policy", parentContentId: null, createdAt: "2026-11-06T00:00:00.000Z",
      appCompatibility: { contentApi: [CONTENT_API_VERSION], schemas: [] }, requiredSyncContract: "2.1.0", families: {}, claimSets: { schools: 0, claims: 0, held: 0, sha256: "0".repeat(64) }, files: [],
      localeIndexPolicy: { path: "locale-index/university-locale-index-policy.json", sha256: "7".repeat(64) },
      translations: { pointer: "translations/current.json", recordDeltaAcceptanceSha256s: ["6".repeat(64)] } };
    mkdirSync(path.join(root, "releases/demo-policy/tree"), { recursive: true });
    const bytes = JSON.stringify(manifest);
    writeFileSync(path.join(root, "releases/demo-policy/manifest.json"), bytes);
    writeFileSync(path.join(root, "current.json"), JSON.stringify({ schemaVersion: "uapt-content-pointer-v1", contentId: "demo-policy", manifestSha256: sha(bytes), sync: { contractVersion: "2.1.0", eventId: "evt", eventSha256: "a".repeat(64) } }));
    delete process.env.UAPT_CONTENT_ROOT; resetContentRuntimeForTests();
    assert.deepEqual(localeIndexPolicySelection(), { file: "/env/policy.json", sha256: "e".repeat(64), source: "environment" });
    process.env.UAPT_CONTENT_ROOT = root; resetContentRuntimeForTests();
    const selected = localeIndexPolicySelection();
    assert.equal(selected.source, "release");
    assert.equal(selected.sha256, "7".repeat(64));
    assert.ok(selected.file?.endsWith("releases/demo-policy/tree/locale-index/university-locale-index-policy.json"));
    assert.deepEqual(readingPackageSelection().recordDeltaAcceptanceSha256s, ["6".repeat(64)]);
  } finally {
    for (const [key, value] of [["UAPT_CONTENT_ROOT", saved.root], ["UAPT_UNIVERSITY_LOCALE_INDEX_POLICY", saved.file], ["UAPT_UNIVERSITY_LOCALE_INDEX_POLICY_SHA256", saved.sha]] as const) value === undefined ? delete process.env[key] : process.env[key] = value;
    resetContentRuntimeForTests();
    rmSync(root, { recursive: true, force: true });
  }
});
