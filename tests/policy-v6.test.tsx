import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PolicyV6Provider,
  PolicyV6Intro,
  PolicyV6ChecklistFaq,
} from "../apps/web/components/policy-v6";
import { PolicyReferenceHero } from "../apps/web/components/policy-reference-layout";
import {
  StudentPolicySnapshot,
  isStrongStudentSnapshot,
} from "../apps/web/components/student-policy-snapshot";
import { getPublicUniversitySummaryBySlug } from "../apps/web/lib/catalog";
import { getLoadedPolicySnapshotBySlug } from "../apps/web/lib/policy-snapshots";
import { getPolicyScenePilot } from "../apps/web/lib/policy-scene-pilot";
import {
  preparePolicyReferenceScene,
  preservePolicyReferenceSearch,
} from "../apps/web/lib/policy-reference-preview";
import { buildPolicyAnalysisProfile } from "../apps/web/lib/policy-analysis";
import { PolicyV6RecordTopics } from "../apps/web/components/policy-v6-record-topics";
import { getPolicyV6Data } from "../apps/web/lib/policy-v6";
import { isPolicyV6Preview } from "../apps/web/lib/policy-v6-gate";
import { policyV6Copy } from "../apps/web/lib/policy-v6-copy";
import { getPolicyV6IllustratedScene } from "../apps/web/lib/policy-v6-illustrated-scene";
import { policyV6StatusTone } from "../apps/web/lib/policy-v6-status";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("Harvard UI remains opt-in, local-only and survives a locale switch", () => {
  assert.equal(
    isPolicyV6Preview("harvard-university", "v6", "development"),
    true,
  );
  for (const [slug, layout, environment] of [
    ["harvard-university", "v6", "production"],
    ["utrecht-university", "v6", "development"],
    ["harvard-university", undefined, "development"],
    ["harvard-university", ["v6"], "development"],
  ] as const)
    assert.equal(isPolicyV6Preview(slug, layout, environment), false);
  const href = preservePolicyReferenceSearch(
    "/zh/universities/harvard-university",
    "?layout=v6&compare=harvard-university,university-of-oxford&view=compare&differences=1",
    "development",
  );
  const url = new URL(href, "https://example.invalid");
  assert.equal(url.searchParams.get("layout"), "v6");
  assert.equal(
    url.searchParams.get("compare"),
    "harvard-university,university-of-oxford",
  );
  assert.equal(url.searchParams.get("differences"), "1");
  for (const locale of ["en", "zh", "fr", "pl", "es", "nl", "ms"] as const) {
    assert.deepEqual(
      Object.keys(policyV6Copy(locale)).sort(),
      Object.keys(policyV6Copy("en")).sort(),
    );
  }
});

test("Harvard enhancement retains all artwork and verbatim server evidence", async () => {
  const [summary, loaded, data] = await Promise.all([
    getPublicUniversitySummaryBySlug("harvard-university"),
    getLoadedPolicySnapshotBySlug("harvard-university"),
    getPolicyV6Data("en"),
  ]);
  assert(summary && isStrongStudentSnapshot(loaded));
  const frozenData = JSON.stringify({ summary, snapshot: loaded.snapshot });
  const scene = getPolicyScenePilot(
    "harvard-university",
    summary.claims,
    true,
    false,
    { isPreview: true },
  );
  assert(scene?.quickGuide);
  const prepared = preparePolicyReferenceScene(scene);
  const contents = (enhanced: boolean) => (
    <>
      <PolicyReferenceHero scene={scene} uiLab={enhanced} />
      <StudentPolicySnapshot
        claims={summary.claims}
        entitySlug="harvard-university"
        snapshot={loaded.snapshot}
        role="student"
        scene={prepared}
        guidanceInHero
        uiLab={enhanced}
      />
    </>
  );
  const baseline = renderToStaticMarkup(contents(false));
  const lab = renderToStaticMarkup(
    <PolicyV6Provider data={data}>
      <PolicyV6Intro />
      {contents(true)}
      <PolicyV6ChecklistFaq />
    </PolicyV6Provider>,
  );
  const images = (html: string) =>
    [...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map((match) => match[1]);
  for (const image of images(baseline)) assert(images(lab).includes(image));
  assert(images(lab).length > images(baseline).length);
  for (const src of [
    scene.artworkSrc,
    scene.quickGuide.do.artworkSrc,
    scene.quickGuide.dont.artworkSrc,
  ])
    assert(lab.includes(src));
  const quotations = (html: string) =>
    [...html.matchAll(/<blockquote[\s\S]*?<\/blockquote>/g)].map(
      (match) => match[0],
    );
  assert.deepEqual(quotations(lab), quotations(baseline));
  for (const topic of loaded.snapshot.dimensions) {
    assert(lab.includes(`id="snapshot-${topic.key}"`));
    assert(lab.includes(`id="snapshot-evidence-${topic.key}"`));
    const title = data.schools[0].topics
      .find((t) => t.key === topic.key)
      ?.title.replaceAll("&", "&amp;");
    assert(lab.includes(`aria-label="Copy link: ${title}"`));
  }
  assert.equal(
    JSON.stringify({ summary, snapshot: loaded.snapshot }),
    frozenData,
  );
});

test("Comparison preserves public summary wording, scoped sources and validation gaps", async () => {
  const data = await getPolicyV6Data("zh");
  for (const school of data.schools) {
    const loaded = await getLoadedPolicySnapshotBySlug(school.slug);
    if (!isStrongStudentSnapshot(loaded)) {
      assert.equal(school.topics.length, 6);
      assert(school.topics.every((t) => t.basisKind === "record_analysis"));
      const summary = await getPublicUniversitySummaryBySlug(school.slug);
      assert(summary);
      for (const topic of school.topics)
        for (const claim of topic.claims)
          assert(
            summary.claims.some(
              (c) =>
                c.id === claim.id &&
                c.claimText === claim.text &&
                ["agent_reviewed", "human_reviewed"].includes(c.reviewState),
            ),
          );
      continue;
    }
    for (const topic of school.topics) {
      const original = loaded.snapshot.dimensions.find(
        (d) => d.key === topic.key,
      );
      assert(original);
      assert.equal(topic.summary, original.summary);
      assert.equal(topic.status, original.status);
      assert.deepEqual(
        topic.sources,
        original.basis.sources.map((s) => ({
          url: s.sourceUrl,
          hash: s.sourceSnapshotHash,
        })),
      );
    }
  }
  assert(data.schools.filter((s) => s.topics.length === 6).length >= 2);
});

test("V6 uses the four new published repair bases and does not replace a held snapshot with an old strong summary", async () => {
  const data = await getPolicyV6Data("zh", "stanford-university");
  const expected = {
    "imperial-college-london": "imperial-20261011-r2",
    "massachusetts-institute-of-technology": "mit-20261010",
    "stanford-university": "stanford-20261011-codex",
    "university-of-oxford": "oxford-20261011-codex",
  };
  for (const [slug, revision] of Object.entries(expected)) {
    const school = data.schools.find((s) => s.slug === slug);
    assert(school);
    assert.equal(school.revision, revision);
    assert.notEqual(school.snapshotStatus, "strong");
    const summary = await getPublicUniversitySummaryBySlug(slug);
    assert(summary);
    const profile = buildPolicyAnalysisProfile(summary);
    assert.equal(
      school.topics.find((t) => t.key === "exams")?.summary,
      profile.dimensions.find((t) => t.key === "exams")?.summary,
    );
  }
  const stanford = data.schools.find((s) => s.slug === "stanford-university")!;
  assert.match(
    stanford.topics.find((t) => t.key === "exams")!.summary,
    /may not ban AI for take-home exams/,
  );
  const html = renderToStaticMarkup(
    <PolicyV6Provider data={data}>
      <PolicyV6Intro />
      <PolicyV6RecordTopics data={data} />
    </PolicyV6Provider>,
  );
  assert.match(html, /规则可能因课程、学院及活动而异|各来源|范围/);
  assert.equal(
    data.schools.find((s) => s.slug === "harvard-university")?.newReviewPending,
    true,
  );
});

test("V6 restores scoped artwork only against the accepted current basis", async () => {
  const data = await getPolicyV6Data("zh");
  for (const school of data.schools.filter(
    (s) => !["harvard-university", "university-of-cambridge"].includes(s.slug),
  )) {
    const scene = getPolicyV6IllustratedScene(school, "zh");
    assert(scene?.quickGuide);
    assert.equal(
      getPolicyV6IllustratedScene({ ...school, fingerprint: "changed" }, "zh"),
      undefined,
    );
    const html = renderToStaticMarkup(
      <PolicyReferenceHero scene={scene} uiLab />,
    );
    for (const src of [
      scene.artworkSrc,
      scene.quickGuide.do.artworkSrc,
      scene.quickGuide.dont.artworkSrc,
    ])
      assert(html.includes(src));
    assert(
      html.includes(
        renderToStaticMarkup(<p>{scene.quickGuide.scopeNote}</p>).slice(3, -4),
      ),
    );
    const topics = renderToStaticMarkup(
      <PolicyV6Provider data={{ ...data, currentSlug: school.slug }}>
        <PolicyV6RecordTopics data={{ ...data, currentSlug: school.slug }} />
      </PolicyV6Provider>,
    );
    for (const topic of school.topics)
      assert(topics.includes(`data-v6-art-section="${topic.key}"`));
  }
  const intro = renderToStaticMarkup(
    <PolicyV6Provider data={data}>
      <PolicyV6Intro />
    </PolicyV6Provider>,
  );
  assert(!intro.includes("data-v6-record-metadata"));
  assert(!intro.includes("哈佛新一轮"));
  const changed = {
    ...data,
    currentSlug: "stanford-university",
    schools: data.schools.map((s) =>
      s.slug === "stanford-university" ? { ...s, fingerprint: "changed" } : s,
    ),
  };
  const changedTopics = renderToStaticMarkup(
    <PolicyV6Provider data={changed}>
      <PolicyV6RecordTopics data={changed} />
    </PolicyV6Provider>,
  );
  assert(!changedTopics.includes("stanford-disclosure-v2.jpg"));
  assert(changedTopics.includes("v6-20261011/disclosure.jpg"));
});

test("V6 status color distinguishes prohibition, conditions and permission", () => {
  assert.equal(policyV6StatusTone("blocked"), "prohibited");
  assert.equal(policyV6StatusTone("allowed"), "allowed");
  for (const status of [
    "restricted",
    "conditionally_allowed",
    "required",
    "unclear",
  ])
    assert.equal(policyV6StatusTone(status), "caution");
  assert.equal(policyV6StatusTone("not_found"), "neutral");
});
