import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getLoadedPolicySnapshotBySlug } from "../apps/web/lib/policy-snapshots";
import { getStagedPublicSummaryBySlug } from "../apps/web/lib/staged-public-data";
import { getPolicyScenePilot } from "../apps/web/lib/policy-scene-pilot";
import { readyV4IllustrationBasis } from "../apps/web/lib/policy-scene-ready-v4";
import { PolicyReferenceHero } from "../apps/web/components/policy-reference-layout";
import { isPublishedV4University } from "../apps/web/lib/policy-reference-preview";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

for (const slug of Object.keys(readyV4IllustrationBasis)) {
  test(`${slug}: V4 requires a valid snapshot and unchanged reviewed evidence`, async () => {
    const summary = await getStagedPublicSummaryBySlug(slug);
    const loaded = await getLoadedPolicySnapshotBySlug(slug);
    assert(summary && loaded);
    assert.equal(loaded.validation.effectiveStatus, "strong");
    assert.equal(isPublishedV4University(slug), true);
    const before = JSON.stringify(summary);
    const scene = getPolicyScenePilot(slug, summary.claims, true, false);
    assert(scene?.studentFirst && scene.quickGuide);
    assert.equal(getPolicyScenePilot(slug, summary.claims, false, true), undefined);
    assert.equal(getPolicyScenePilot(slug, [], true, false), undefined);
    const changed = structuredClone(summary.claims);
    changed[0].claimText += " altered policy";
    assert.equal(getPolicyScenePilot(slug, changed, true, false), undefined);
    for (const panel of [scene.quickGuide.do, scene.quickGuide.dont]) {
      for (const check of panel.checks) {
        if (check.evidenceHref.startsWith("#claim-")) {
          assert(summary.claims.some(claim => `#claim-${claim.id}` === check.evidenceHref));
        } else {
          assert(loaded.snapshot.dimensions.some(dimension => `#snapshot-${dimension.key}` === check.evidenceHref));
        }
      }
    }
    for (const src of [scene.artworkSrc, scene.quickGuide.do.artworkSrc, scene.quickGuide.dont.artworkSrc]) {
      const image = await readFile(new URL(`../apps/web/public${src}`, import.meta.url));
      assert.deepEqual([...image.subarray(0, 2)], [255, 216], src);
      assert(image.length < 400_000, `${src}: optimized asset budget`);
    }
    assert.equal(JSON.stringify(summary), before);
  });
}

test("Melbourne exposes the moved-source and dated-evidence limitation before the actions", async () => {
  const summary = await getStagedPublicSummaryBySlug("university-of-melbourne");
  assert(summary);
  const scene = getPolicyScenePilot(summary.entity.slug, summary.claims, true, false);
  assert(scene?.sourceUpdate);
  assert.match(scene.sourceUpdate.text, /older reviewed record/);
  assert.match(scene.sourceUpdate.text, /could not be reverified/);
  const html = renderToStaticMarkup(<PolicyReferenceHero scene={scene} locale="zh" />);
  assert(html.indexOf('href="#current-source-supplement"') < html.indexOf('class="policy-reference-actions"'));
  assert.match(html, /来源核查与历史证据/);
  assert(!scene.quickGuide?.dont.checks.some(check => /privacy|citation|SparkAI/.test(check.text)));
});
