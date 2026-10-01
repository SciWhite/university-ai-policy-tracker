import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { isPolicyReferencePreview, policyReferencePreviewSlugs, preparePolicyReferenceScene, preservePolicyReferenceSearch } from "../apps/web/lib/policy-reference-preview";
import { PolicySceneGallery } from "../apps/web/components/policy-quick-guide";
import { PolicyReferenceHero } from "../apps/web/components/policy-reference-layout";
import { StudentPolicySnapshot } from "../apps/web/components/student-policy-snapshot";
import { getStagedPublicSummaryBySlug } from "../apps/web/lib/staged-public-data";
import { getLoadedPolicySnapshotBySlug } from "../apps/web/lib/policy-snapshots";
import { getPolicyScenePilot } from "../apps/web/lib/policy-scene-pilot";

// Match the existing SSR test harness for Next's JSX-preserve configuration.
(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("comparison cannot activate in production or for another university", () => {
  assert.equal(isPolicyReferencePreview("stanford-university", "reference-v4", "production"), false);
  assert.equal(isPolicyReferencePreview("aalto-university", "reference-v4", "development"), false);
  assert.equal(isPolicyReferencePreview("stanford-university", undefined, "development"), false);
  assert.equal(isPolicyReferencePreview("stanford-university", ["reference-v4"], "development"), false);
  assert.equal(isPolicyReferencePreview("stanford-university", "reference-v4", "development"), true);
});

test("moving guidance to the hero preserves scoped actions and server-rendered evidence", async () => {
  const summary = await getStagedPublicSummaryBySlug("stanford-university");
  const loaded = await getLoadedPolicySnapshotBySlug("stanford-university");
  assert(summary && loaded);
  const scene = getPolicyScenePilot("stanford-university", summary.claims, true, false);
  assert(scene?.quickGuide);
  const before = JSON.stringify({claims:summary.claims,snapshot:loaded.snapshot});
  const hero = renderToStaticMarkup(<PolicyReferenceHero scene={scene} />);
  assert.match(hero, /PWR: don&#x27;t use AI/);
  assert.match(hero, /MD\/MSPA: don&#x27;t use AI/);
  assert.match(hero, /Medicine: don&#x27;t paste patient data/);
  const html = renderToStaticMarkup(<StudentPolicySnapshot claims={summary.claims} entitySlug="stanford-university" role="student" scene={scene} snapshot={loaded.snapshot} guidanceInHero />);
  const baseline = renderToStaticMarkup(<StudentPolicySnapshot claims={summary.claims} entitySlug="stanford-university" role="student" scene={scene} snapshot={loaded.snapshot} />);
  for (const dimension of ["coursework","exams","disclosure","privacy_data","approved_tools","research_publication"]) {
    assert(html.includes(`id="snapshot-${dimension}"`));
    assert(html.includes(`id="snapshot-evidence-${dimension}"`));
  }
  const sources = (value:string) => [...value.matchAll(/href="(https:[^"]+)"/g)].map(m=>m[1]).sort();
  const baselineSources = sources(baseline);
  for (const source of baselineSources) assert(sources(html + hero).includes(source));
  assert.equal(JSON.stringify({claims:summary.claims,snapshot:loaded.snapshot}), before);
});

for (const slug of policyReferencePreviewSlugs.filter(slug => slug !== "stanford-university")) {
  test(`${slug}: V4 retains every action, scope and evidence target`, async () => {
    assert.equal(isPolicyReferencePreview(slug, "reference-v4", "development"), true);
    assert.equal(isPolicyReferencePreview(slug, "reference-v4", "production"), false);
    const summary = await getStagedPublicSummaryBySlug(slug);
    const loaded = await getLoadedPolicySnapshotBySlug(slug);
    assert(summary);
    if (!loaded) {
      const scene = getPolicyScenePilot(slug, summary.claims, false, true, { isPreview: true });
      assert(scene?.quickGuide);
      const html = renderToStaticMarkup(<PolicyReferenceHero scene={scene} locale="zh" />);
      assert(html.includes("尚未发布已审核的学生政策快照"));
      const nav = renderToStaticMarkup(<PolicyReferenceNavigation claimsOnly locale="zh" />);
      assert(!nav.includes("#snapshot-"));
      for (const panel of [scene.quickGuide.do, scene.quickGuide.dont]) {
        for (const check of panel.checks) {
          if (check.evidenceHref.startsWith("#claim-")) assert(summary.claims.some(claim => `#claim-${claim.id}` === check.evidenceHref));
        }
      }
      return;
    }
    const scene = getPolicyScenePilot(slug, summary.claims, true, false, { isPreview: true });
    assert(scene?.quickGuide);
    const hero = renderToStaticMarkup(<PolicyReferenceHero scene={scene} />);
    const decode = (text: string) => text.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
    const heroText = decode(hero);
    assert(heroText.includes(scene.guidance || scene.quickGuide.scopeNote));
    for (const panel of [scene.quickGuide.do, scene.quickGuide.dont]) {
      for (const check of panel.checks) {
        assert(heroText.includes(check.text));
        assert(heroText.includes(check.evidenceHref));
      }
    }
    const html = renderToStaticMarkup(<StudentPolicySnapshot claims={summary.claims} entitySlug={slug} role="student" scene={scene} snapshot={loaded.snapshot} guidanceInHero />);
    const baseline = renderToStaticMarkup(<StudentPolicySnapshot claims={summary.claims} entitySlug={slug} role="student" scene={scene} snapshot={loaded.snapshot} />);
    const sources = (value: string) => [...value.matchAll(/href="(https:[^"]+)"/g)].map(match => match[1]);
    for (const source of sources(baseline)) assert(sources(html + hero).includes(source));
    for (const dimension of ["coursework", "exams", "disclosure", "privacy_data", "approved_tools", "research_publication"]) {
      assert(html.includes(`id="snapshot-${dimension}"`));
    }
  });
}

import { SUPPORTED_LOCALES } from "../apps/web/lib/i18n";
import { policyReferenceUi, translatePolicyReferenceUi } from "../apps/web/lib/policy-reference-ui";
import { PolicyReferenceNavigation } from "../apps/web/components/policy-reference-layout";

test("all seven interfaces translate controls while retaining original policy evidence", () => {
  for (const locale of SUPPORTED_LOCALES) {
    const nav = renderToStaticMarkup(<PolicyReferenceNavigation locale={locale} />);
    assert(nav.includes(`href="#snapshot-coursework"`));
    for (const key of [...Object.keys(policyReferenceUi), "Academic Integrity", "Teaching", "Research", "Common situations", "Find your next step", "Scope and transition details", "No reviewed student policy snapshot has been published yet."]) {
      const translated = translatePolicyReferenceUi(key, locale);
      assert(translated.length > 0);
      if (locale !== "en") assert.notEqual(translated, key, `${locale}: ${key}`);
    }
    if (locale !== "en") assert(!nav.includes('>On this page<'));
  }
});

for (const slug of policyReferencePreviewSlugs) {
  test(`${slug}: every approved image is retained in its corresponding policy region`, async () => {
    const summary = await getStagedPublicSummaryBySlug(slug);
    const loaded = await getLoadedPolicySnapshotBySlug(slug);
    assert(summary);
    const sourceScene = getPolicyScenePilot(slug, summary.claims, Boolean(loaded), !loaded, { isPreview: true });
    assert(sourceScene?.quickGuide);
    const scene = preparePolicyReferenceScene(sourceScene);
    const hero = renderToStaticMarkup(<PolicyReferenceHero scene={scene} locale="zh" />);
    for (const kind of ["do", "dont"] as const) {
      const region = hero.match(new RegExp(`policy-reference-action--${kind}[\\s\\S]*?</article>`))?.[0];
      assert(region?.includes(sourceScene.quickGuide[kind].artworkSrc));
    }
    const snapshot = loaded ? renderToStaticMarkup(<StudentPolicySnapshot claims={summary.claims} entitySlug={slug} role="student" scene={scene} snapshot={loaded.snapshot} guidanceInHero locale="zh" />) : renderToStaticMarkup(<PolicySceneGallery scene={scene} locale="zh" />);
    for (const card of sourceScene.storyCards ?? []) assert(snapshot.includes(card.artworkSrc), card.artworkSrc);
    if (loaded) assert(snapshot.includes("已审核证据与官方来源"));
    if (loaded) assert(snapshot.includes("课程与作业"));
    assert(!snapshot.includes('>View evidence'));
    assert.equal(sourceScene.quickGuide.scopeNote, scene.quickGuide?.scopeNote);
  });
}

import { localizeSurfaceTree } from "../apps/web/lib/surface-localization";

test("localizing static child arrays gives stable React keys", () => {
  const input = [<span>Reviewed claims</span>, <span>Official sources</span>];
  const localized = localizeSurfaceTree(input, "zh") as React.ReactElement[];
  assert.equal(localized.length, 2);
  assert(localized.every(node => node.key !== null));
  assert.notEqual(localized[0].key, localized[1].key);
  const parent = localizeSurfaceTree(<section>{input}</section>, "zh") as React.ReactElement<{children: React.ReactElement[]}>;
  assert(parent.props.children.every(node => node.key !== null));
  assert.notEqual(parent.props.children[0].key, parent.props.children[1].key);
});

test("language switch fallback preserves only authorized development comparisons", () => {
  assert.equal(preservePolicyReferenceSearch("/zh/universities/harvard-university", "?layout=reference-v4", "development"), "/zh/universities/harvard-university?layout=reference-v4");
  assert.equal(preservePolicyReferenceSearch("/fr/universities/stanford-university", "?layout=reference-v4", "production"), "/fr/universities/stanford-university");
  assert.equal(preservePolicyReferenceSearch("/zh/universities/aalto-university", "?layout=reference-v4", "development"), "/zh/universities/aalto-university");
});
