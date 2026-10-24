import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { V6ChangeNote } from "../apps/tulsa-zone/components/v6-change-note";
import { V6CompactChangeNote } from "../apps/tulsa-zone/components/v6-compact-change-note";
import HistoryPage from "../apps/web/app/(default)/changes/[releaseId]/page";
import { getEntityChangeHistory } from "../apps/web/lib/change-records";
import { countCorrectionIds, exactClaimDiffLines, hasRecordedChanges, selectChangeSummary } from "../apps/web/lib/change-presentation";
import { changeSummaryText } from "../apps/web/lib/localized-change-summary";
import { changesUi } from "../apps/web/lib/changes-ui";
import { discoveryCopy } from "../apps/web/lib/discovery-copy";
import type { ReleaseDiffRow } from "../apps/web/lib/release-diffs";
import { readV6RecordCorrections, readV6RecordCorrectionRevision } from "../apps/web/lib/v6-effective-records";
import { v6FrozenHistory } from "../apps/web/lib/v6-history-cache";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
process.env.UAPT_V6_PUBLISHED_PAGES = "1";

const locales = ["en", "zh", "fr", "pl", "es", "nl", "ms"] as const;

test("correction IDs count once and added/updated overlap cannot inflate the total", () => {
  const counts = countCorrectionIds({
    addedClaimIds: ["a", "a"], updatedClaimIds: ["a", "b", "b"],
    heldClaimIds: ["c", "c", "b"]
  });
  assert.deepEqual([counts.added, counts.modified, counts.held, counts.affected], [1, 1, 2, 3]);
});

test("localized editorial summaries prefer the requested language and explicitly identify fallback", () => {
  const value = { en: "English original", zh: "中文原稿" };
  assert.deepEqual(selectChangeSummary(value, "zh"), { text: "中文原稿", language: "zh" });
  assert.deepEqual(selectChangeSummary(value, "fr"), { text: "English original", language: "en" });
  assert.equal(selectChangeSummary({ en: "", zh: "中文" }, "en")?.language, "zh");
  assert.equal(selectChangeSummary(null, "zh"), undefined);
  assert.deepEqual(value, { en: "English original", zh: "中文原稿" });
});

test("no raw comparison never turns current claims or cached preview lines into additions", () => {
  assert.deepEqual(exactClaimDiffLines({ diffRows: [] }), []);
  const oldClaim = { claimId: "same", claimText: "Original sentence" };
  const newClaim = { claimId: "same", claimText: "Corrected sentence" };
  const row = { changeType: "claim_modified", matchMethod: "claim_id", oldClaim, newClaim } as ReleaseDiffRow;
  assert.deepEqual(exactClaimDiffLines({ diffRows: [row] }), [
    { type: "delete", value: oldClaim.claimText }, { type: "insert", value: newClaim.claimText }
  ]);
  assert.deepEqual(exactClaimDiffLines({ diffRows: [{ ...row, matchMethod: "fuzzy_claim" }] }), []);
  assert.deepEqual(exactClaimDiffLines({ diffRows: [{ ...row, newClaim: { ...newClaim, claimId: "different" } }] }), []);
  assert.deepEqual(exactClaimDiffLines({ publicationKind: "scoped_record_correction", diffRows: [row] }), []);
});

test("all seven interfaces have localized tracker labels and correction templates", () => {
  for (const locale of locales) {
    const label = discoveryCopy(locale).policyText;
    const summary = changeSummaryText("Tracker record correction: 2 updated claims, 1 newly recorded claims, 3 held or excluded claims.", locale)!;
    assert.equal(summary.language, locale);
    assert.ok(!summary.text.includes("{0}"));
    assert.ok(summary.text.includes("2") && summary.text.includes("1") && summary.text.includes("3"));
    if (locale !== "en") {
      assert.notEqual(label, discoveryCopy("en").policyText);
      assert.notEqual(changesUi("Recorded updates", locale), "Recorded updates");
    }
    assert.ok(!label.includes("Policy text comparison"));
  }
});

test("real frozen V6 correction retains its IDs and no-diff state without saying no updates", async () => {
  const pkg = readV6RecordCorrections()!;
  const slug = "harvard-university";
  const before = JSON.stringify(v6FrozenHistory(slug));
  const history = (await getEntityChangeHistory(slug, "zh"))!;
  assert.ok(history);
  assert.equal(history.record.publicationKind, "scoped_record_correction");
  assert.ok(hasRecordedChanges(history.record));
  assert.deepEqual(exactClaimDiffLines(history.record), []);
  const actualRevision = readV6RecordCorrectionRevision(pkg.recordRevisions[slug].universityRevisionId)!;
  const { addedClaimIds, updatedClaimIds, heldClaimIds } = actualRevision.changesBySlug[slug];
  assert.ok(addedClaimIds.length + updatedClaimIds.length + heldClaimIds.length > 0);
  assert.equal(JSON.stringify(v6FrozenHistory(slug)), before);
});

test("real localized history page renders localized headings and distinguishes unavailable text from no changes", async () => {
  for (const locale of locales) {
    const html = renderToStaticMarkup(await HistoryPage({ params: Promise.resolve({ locale, releaseId: "harvard-university" }) }));
    assert.ok(!html.includes("No tracker claim/evidence/source changes are recorded"));
    assert.ok(!html.includes("with no release-to-release policy diff rows recorded yet"));
    assert.ok(html.includes(changesUi("Recorded updates are available; a comparable before-and-after text preview is not available for this revision.", locale)));
    if (locale !== "en") {
      assert.ok(!html.includes(">Release history<"), locale);
      assert.ok(!html.includes(">Change log<"), locale);
    }
  }
});


test("shared-zone notes localize controls while marking preserved English content", () => {
  for (const locale of locales) {
    const note = renderToStaticMarkup(V6ChangeNote({ slug: "harvard-university", locale }));
    const compact = renderToStaticMarkup(V6CompactChangeNote({ slug: "harvard-university", locale }));
    assert.ok(note.includes(changeSummaryText("Tracker record correction: 30 updated claims, 5 newly recorded claims, 0 held or excluded claims.", locale)!.text));
    assert.ok(!note.includes("Historical page-supplement release"));
    if (locale !== "en") {
      assert.ok(!note.includes(">Policy record and evidence correction<"), locale);
      assert.ok(!note.includes(">Tracker correction differences<"), locale);
      assert.ok(!compact.includes(">Compact V6 template update<"), locale);
    }
    if (locale !== "en" && locale !== "zh") {
      assert.ok(compact.includes('lang="en"'));
      assert.ok(compact.includes(discoveryCopy(locale).summaryFallback));
    }
  }
});
