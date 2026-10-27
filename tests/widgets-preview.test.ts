import test, {before, after} from "node:test";
import assert from "node:assert/strict";
import {
  getWidgetPreviewRecords, getPolicyCoverageWidget, getRecentChangesWidget,
  buildPolicyCoverageWidget
} from "../apps/web/lib/developer-surfaces";
import {getPolicyAnalysisProfileBySlug} from "../apps/web/lib/policy-analysis";
import {getStagedPublicSummaryBySlug} from "../apps/web/lib/staged-public-data";
import {getChangeIndexData} from "../apps/web/lib/change-records";

const original = process.env.UAPT_V6_PUBLISHED_PAGES;
before(() => { process.env.UAPT_V6_PUBLISHED_PAGES = "1"; });
after(() => {
  if (original === undefined) delete process.env.UAPT_V6_PUBLISHED_PAGES;
  else process.env.UAPT_V6_PUBLISHED_PAGES = original;
});
const withoutClock = <T extends {generatedAt: string}>(value: T) => {
  const {generatedAt: _clock, ...fields} = value;
  return fields;
};

test("cold widget previews complete within the static generation budget", {timeout: 90_000}, async () => {
  const previews = await getWidgetPreviewRecords();
  assert(previews.statusWidget && previews.policyCoverageWidget);
  assert(previews.sourceFreshnessWidget && previews.reviewStateWidget);
  assert.equal(previews.recentChangesWidget.data.count, 5);
  assert.equal(previews.statusWidget.data.entitySlug, "anu");
});

test("single-school coverage preserves the full analysis result and missing-school behavior", async () => {
  const summary = await getStagedPublicSummaryBySlug("anu");
  const profile = await getPolicyAnalysisProfileBySlug("anu");
  assert(summary && profile);
  const actual = await getPolicyCoverageWidget("anu");
  assert(actual);
  assert.deepEqual(withoutClock(actual), withoutClock(buildPolicyCoverageWidget(profile, summary)));
  assert.equal(await getPolicyCoverageWidget("university-that-does-not-exist"), undefined);
});

test("recent widget keeps published ordering, limits, dates and review boundaries", async () => {
  const index = (await getChangeIndexData()).data.records;
  for (const [limit, expectedCount] of [[0, 1], [5, 5], [15, 10], [Infinity, 5]]) {
    const widget = await getRecentChangesWidget(limit);
    assert.equal(widget.data.count, expectedCount);
    for (const [i, item] of widget.data.changes.entries()) {
      const expected = index[i];
      assert.equal(item.entitySlug, expected.slug);
      assert.equal(item.lastChangedAt, expected.lastChangedAt);
      assert.equal(item.lastCheckedAt, expected.lastCheckedAt);
      assert.equal(item.reviewState, expected.reviewState);
      assert.equal(item.claimCount, expected.claimCount);
      assert.equal(item.reviewedClaimCount + item.candidateClaimCount, item.claimCount);
      assert.equal(item.sourceCount, expected.sourceCount);
      assert.equal(item.publicJsonUrl, expected.publicJsonUrl);
      if (["agent_reviewed", "human_reviewed"].includes(item.reviewState)) {
        assert.equal(item.summaryPreview, expected.summary);
      } else {
        assert.equal(item.summaryPreview, "Review pending. Use canonical source-backed records before treating this as a policy conclusion.");
      }
    }
  }
});
