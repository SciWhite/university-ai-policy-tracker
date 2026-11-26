import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getReadingTranslations, isVerifiedReadingBundle, READING_EMPTY_BASIS,
  type ReadingDeltaReviewReceipt, type ReadingRecordBasis, type ReadingRecordDelta, type ReadingTranslationBundle, type ReadingTranslationDelta, type ReadingTranslationSelection
} from "../apps/web/lib/reading-translations";
import { readingDisplayRequirementsComplete } from "../apps/web/lib/university-reading-metadata";
import { releaseZhReadingLookups } from "../scripts/v6-pipeline/locale-gate";
import { resetContentRuntimeForTests } from "../apps/web/lib/content-runtime";

/**
 * Display deltas (docs/content-release.md §12.4): a school outside the sampled corpus gains a locale from the
 * empty basis, and a school whose page text changed on an unchanged record gains the new strings through a
 * same-record delta. Both are ordinary record deltas: every pair independently reviewed, the receipt pinned.
 */
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const unit = (source: string, translation: string) => ({ source, sourceSha256: sha(source), translation });
const REC = { recordSha256: "1".repeat(64), originalEvidenceSha256: "2".repeat(64) };
const CORPUS = "a".repeat(64);
const GAP = "The faculty page was not captured.", CLAIM = "Students must disclose AI use.", NEWGAP = "The 2026 exam rules were not published.";

function makeRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), "uapt-display-delta-"));
  const put = (name: string, value: unknown) => {
    const bytes = JSON.stringify(value);
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFileSync(path.join(root, name), bytes);
    return { path: name, sha256: sha(bytes) };
  };
  return { root, put, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
const bundle = (slug: string, locale: "zh" | "fr", strings: ReturnType<typeof unit>[], uses: Record<string, string[]>, basis = REC): ReadingTranslationBundle => ({
  schemaVersion: "uapt-reading-translations-v1", sourceSha256: CORPUS, locale, slug, ...basis,
  review: { status: "accepted", receiptSha256: "d".repeat(64) }, protectedClaimIds: [],
  requiredSourceHashes: strings.map(s => s.sourceSha256), strings: Object.fromEntries(strings.map(s => [s.sourceSha256, s])), sourceFieldUses: uses
});
function delta(put: ReturnType<typeof makeRoot>["put"], revision: string, parentSelectionSha256: string, slug: string, parent: ReadingRecordBasis, locales: Record<string, ReturnType<typeof unit>[]>, options: { reviewer?: string; tamper?: boolean } = {}) {
  const pairs: ReadingDeltaReviewReceipt["pairs"] = [];
  const files: Record<string, { path: string; sha256: string }> = {};
  for (const [locale, units] of Object.entries(locales)) {
    const d: ReadingTranslationDelta = { schemaVersion: "uapt-reading-translation-delta-v1", revision, corpusSourceSha256: CORPUS, locale: locale as "zh", slug, parent, record: REC, protectedClaimIds: ["c1"],
      strings: Object.fromEntries(units.map(u => [u.sourceSha256, u])), sourceFieldUses: Object.fromEntries(units.map((u, i) => [u.sourceSha256, [`/view/gaps/${i}`]])) };
    files[locale] = put(`record-deltas/${revision}/${locale}/${slug}.json`, d);
    for (const [i, u] of units.entries()) pairs.push({ slug, locale: locale as "zh", sourceSha256: u.sourceSha256, targetSha256: sha(options.tamper ? "x" : u.translation), fieldUses: [`/view/gaps/${i}`], origin: "new_translation", verdict: "accepted" });
  }
  const receipt: ReadingDeltaReviewReceipt = { schemaVersion: "uapt-reading-delta-review-v1", status: "accepted", revision, parentSelectionSha256, corpusSourceSha256: CORPUS,
    translator: { id: "sonnet-translator", method: "agent translation" }, reviewer: { id: options.reviewer ?? "chatgpt-reviewer", method: "independent review of every pair" },
    reviewedAt: "2026-11-26T00:00:00.000Z", coverage: "every_delta_pair", nativeSpeakerApproval: false, publicationApproved: false, pairs };
  const receiptRef = put(`record-deltas/${revision}/review.json`, receipt);
  const recordDelta: ReadingRecordDelta = { schemaVersion: "uapt-reading-record-delta-v1", revision, parentSelectionSha256, receipt: receiptRef, schools: { [slug]: { parent, record: REC, locales: files } } };
  return { recordDelta, receiptSha256: receiptRef.sha256 };
}
function select(put: ReturnType<typeof makeRoot>["put"], root: string, selection: ReadingTranslationSelection, name: string) {
  const ref = put(`selection-${name}.json`, selection);
  writeFileSync(path.join(root, `${name}.json`), JSON.stringify(ref));
  return { pointer: path.join(root, `${name}.json`), sha256: ref.sha256 };
}
async function withPins<T>(pins: string[], fn: () => Promise<T>): Promise<T> {
  const saved = { pins: process.env.UAPT_READING_RECORD_DELTA_ACCEPTANCE_SHA256S, root: process.env.UAPT_CONTENT_ROOT };
  process.env.UAPT_READING_RECORD_DELTA_ACCEPTANCE_SHA256S = pins.join(",");
  delete process.env.UAPT_CONTENT_ROOT;
  resetContentRuntimeForTests();
  try { return await fn(); } finally {
    if (saved.pins === undefined) delete process.env.UAPT_READING_RECORD_DELTA_ACCEPTANCE_SHA256S; else process.env.UAPT_READING_RECORD_DELTA_ACCEPTANCE_SHA256S = saved.pins;
    if (saved.root !== undefined) process.env.UAPT_CONTENT_ROOT = saved.root;
    resetContentRuntimeForTests();
  }
}
function base(put: ReturnType<typeof makeRoot>["put"]): ReadingTranslationSelection {
  return { schemaVersion: "uapt-reading-selection-v1", revision: "base", sourceSha256: CORPUS, publicationApproved: true,
    shared: { zh: put("shared-zh.json", bundle("_shared", "zh", [unit("Overview", "概览")], {})), fr: put("shared-fr.json", bundle("_shared", "fr", [unit("Overview", "Aperçu")], {})) },
    schools: { ucl: { zh: put("ucl-zh.json", bundle("ucl", "zh", [unit(GAP, "学院页面未被抓取。")], { [sha(GAP)]: ["/view/gaps/0"] })) } } };
}

test("a school outside the corpus is served from an empty-basis delta, one locale at a time", async () => {
  const { root, put, cleanup } = makeRoot();
  try {
    const sel = base(put);
    const parent = select(put, root, sel, "parent");
    const zh = delta(put, "new-zh", parent.sha256, "montreal", READING_EMPTY_BASIS, { zh: [unit(CLAIM, "学生必须披露 AI 使用情况。")] });
    const s1 = select(put, root, { ...sel, revision: "new-zh", supplemental: { recordDeltas: [zh.recordDelta] } }, "s1");
    await withPins([zh.receiptSha256], async () => {
      assert.equal((await getReadingTranslations("montreal", "zh", REC, parent.pointer)).state, "unavailable");
      const result = await getReadingTranslations("montreal", "zh", REC, s1.pointer);
      assert.equal(result.state, "ready");
      if (result.state !== "ready") return;
      assert.equal(isVerifiedReadingBundle(result.school), true);
      assert.equal(readingDisplayRequirementsComplete([{ source: CLAIM, field: "/view/gaps/0" }], result.school, result.shared), true);
      assert.equal((await getReadingTranslations("montreal", "fr", REC, s1.pointer)).state, "unavailable", "zh does not make fr available");
    });
    await withPins([], async () => assert.equal((await getReadingTranslations("montreal", "zh", REC, s1.pointer)).state, "unapproved"));
    // A later release adds fr from the empty basis too; zh keeps working.
    const fr = delta(put, "new-fr", s1.sha256, "montreal", READING_EMPTY_BASIS, { fr: [unit(CLAIM, "Les étudiants doivent déclarer leur utilisation de l'IA.")] });
    const s2 = select(put, root, { ...sel, revision: "new-fr", supplemental: { recordDeltas: [zh.recordDelta, fr.recordDelta] } }, "s2");
    await withPins([zh.receiptSha256, fr.receiptSha256], async () => {
      assert.equal((await getReadingTranslations("montreal", "zh", REC, s2.pointer)).state, "ready");
      assert.equal((await getReadingTranslations("montreal", "fr", REC, s2.pointer)).state, "ready");
      assert.equal((await getReadingTranslations("montreal", "zh", { recordSha256: "9".repeat(64), originalEvidenceSha256: "2".repeat(64) }, s2.pointer)).state, "stale_record");
    });
    // The release gate reads the same chain.
    const tree = mkdtempSync(path.join(os.tmpdir(), "uapt-display-tree-"));
    try {
      mkdirSync(path.join(tree, "translations"), { recursive: true });
      const { cpSync } = await import("node:fs");
      cpSync(root, path.join(tree, "translations"), { recursive: true });
      writeFileSync(path.join(tree, "translations/current.json"), JSON.stringify(JSON.parse(await (await import("node:fs/promises")).readFile(s2.pointer, "utf8"))));
      const { lookups, info } = releaseZhReadingLookups(tree, { montreal: REC.recordSha256 }, [zh.receiptSha256, fr.receiptSha256]);
      assert.equal(info.schools, 1);
      assert.equal(lookups.montreal(CLAIM), true);
      assert.equal(releaseZhReadingLookups(tree, { montreal: REC.recordSha256 }, []).info.schools, 0, "unpinned deltas do not count");
    } finally { rmSync(tree, { recursive: true, force: true }); }
  } finally { cleanup(); }
});

test("a same-record delta adds display strings to a corpus bundle; a tampered one is refused", async () => {
  const { root, put, cleanup } = makeRoot();
  try {
    const sel = base(put);
    const parent = select(put, root, sel, "parent");
    const good = delta(put, "gaps-zh", parent.sha256, "ucl", REC, { zh: [unit(NEWGAP, "2026 年考试规则尚未公布。")] });
    const s1 = select(put, root, { ...sel, revision: "gaps-zh", supplemental: { recordDeltas: [good.recordDelta] } }, "s1");
    await withPins([good.receiptSha256], async () => {
      const before = await getReadingTranslations("ucl", "zh", REC, parent.pointer);
      assert.equal(before.state === "ready" && before.school.strings[sha(NEWGAP)], undefined);
      const after = await getReadingTranslations("ucl", "zh", REC, s1.pointer);
      assert.equal(after.state, "ready");
      if (after.state !== "ready") return;
      assert.equal(after.school.strings[sha(GAP)].translation, "学院页面未被抓取。", "the corpus strings are kept");
      assert.match(after.school.strings[sha(NEWGAP)].translation, /2026/);
    });
    await withPins([], async () => assert.equal((await getReadingTranslations("ucl", "zh", REC, s1.pointer)).state, "unapproved", "an unpinned same-record delta is not silently ignored"));
    // The release gate agrees: an unpinned delta up to the page's record means no package coverage.
    const tree = mkdtempSync(path.join(os.tmpdir(), "uapt-display-tree-"));
    try {
      const { cpSync, readFileSync } = await import("node:fs");
      cpSync(root, path.join(tree, "translations"), { recursive: true });
      writeFileSync(path.join(tree, "translations/current.json"), readFileSync(s1.pointer));
      assert.equal(releaseZhReadingLookups(tree, { ucl: REC.recordSha256 }, []).info.schools, 0);
      assert.equal(releaseZhReadingLookups(tree, { ucl: REC.recordSha256 }, [good.receiptSha256]).info.schools, 1);
    } finally { rmSync(tree, { recursive: true, force: true }); }
    for (const [name, options] of [["self review", { reviewer: "sonnet-translator" }], ["tampered target", { tamper: true }]] as const) {
      const bad = delta(put, `bad-${name.replace(/ /g, "-")}`, parent.sha256, "ucl", REC, { zh: [unit(NEWGAP, "2026 年考试规则尚未公布。")] }, options);
      const s = select(put, root, { ...sel, revision: "bad", supplemental: { recordDeltas: [bad.recordDelta] } }, `bad-${name.replace(/ /g, "-")}`);
      await withPins([bad.receiptSha256], async () => assert.equal((await getReadingTranslations("ucl", "zh", REC, s.pointer)).state, "unapproved", name));
    }
  } finally { cleanup(); }
});
