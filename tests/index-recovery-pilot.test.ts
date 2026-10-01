import { hasCurrentIndexRecoveryBasis } from "../apps/web/lib/index-recovery-basis";
import { indexRecoveryContentDate, indexRecoveryRecordDate } from "../apps/web/lib/index-recovery-dates";
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { policySnapshotSchema, type PolicySnapshot } from "@uapt/shared";
import {
  INDEX_RECOVERY_CONTENT_VERSION,
  INDEX_RECOVERY_PILOT_SLUGS,
  buildIndexRecoveryDescription,
  buildIndexRecoveryTitle,
  getIndexRecoveryPilotLocaleRestriction,
  getIndexRecoveryPilotSlugFromPath,
  isIndexRecoveryPilotSlug
} from "../apps/web/lib/index-recovery-pilot";
import {
  groupReviewedClaimsByClaimType,
  groupReviewedClaimsBySnapshotDimensions
} from "../apps/web/lib/university-claims-organization";
import { selectRelatedUniversities } from "../apps/web/lib/related-universities";
import { getLocalizedAlternates } from "../apps/web/lib/i18n-metadata";
import { getStagedPublicSummaryBySlug } from "../apps/web/lib/staged-public-data";
import { getLoadedPolicySnapshotBySlug } from "../apps/web/lib/policy-snapshots";
import { getStagedCatalogUniversities, getStagedPublicSummaries } from "../apps/web/lib/staged-public-data";
import { UniversityClaimGroups } from "../apps/web/components/university-claim-groups";
import { RelatedUniversities } from "../apps/web/components/related-universities";
import { STUDENT_SNAPSHOT_DIMENSION_ORDER, StudentPolicySnapshot } from "../apps/web/components/student-policy-snapshot";
import { getPolicyScenePilot } from "../apps/web/lib/policy-scene-pilot";
import { PolicySceneHero } from "../apps/web/components/policy-scene-hero";
import { PolicySceneStory, policySceneCardId } from "../apps/web/components/policy-scene-story";
import { PolicyQuickGuide, PolicySceneGallery } from "../apps/web/components/policy-quick-guide";
import type { PolicyClaim } from "@uapt/shared";

function reviewedClaimsOf(claims: PolicyClaim[]): PolicyClaim[] {
  return claims.filter(
    (claim) =>
      claim.reviewState === "agent_reviewed" ||
      claim.reviewState === "human_reviewed"
  );
}

test("the illustrated cohort is exactly twenty reviewed slugs", () => {
  assert.equal(INDEX_RECOVERY_PILOT_SLUGS.length, 20);
  assert.equal(isIndexRecoveryPilotSlug("university-of-oxford"), true);
  assert.equal(isIndexRecoveryPilotSlug("university-of-surrey"), true);
  assert.equal(isIndexRecoveryPilotSlug("university-of-cambridge"), false);
  assert.equal(isIndexRecoveryPilotSlug("the-university-of-oxford"), false);

  assert.equal(
    getIndexRecoveryPilotSlugFromPath("/universities/manchester"),
    "manchester"
  );
  assert.equal(
    getIndexRecoveryPilotSlugFromPath("/zh/universities/manchester"),
    "manchester"
  );
  assert.equal(
    getIndexRecoveryPilotSlugFromPath("/universities/university-of-cambridge"),
    undefined
  );
  assert.equal(
    getIndexRecoveryPilotSlugFromPath("/universities"),
    undefined
  );
});

test("scene cohort stays limited to twenty evidence-backed states", async () => {
  const strongSlugs = [
    "harvard-university", "unsw-sydney", "university-of-sydney",
    "national-university-of-singapore", "university-of-oxford", "utrecht-university",
    "imperial-college-london", "adelaide-university", "de-la-salle-university", "ubc",
    "university-of-auckland"
  ];
  const claimsSummarySlugs = [
    "university-of-bristol", "manchester", "edinburgh", "deakin-university", "university-of-surrey",
    "university-of-queensland", "university-of-johannesburg", "anu", "durham-university"
  ];
  assert.deepEqual(new Set([...strongSlugs, ...claimsSummarySlugs]), new Set(INDEX_RECOVERY_PILOT_SLUGS));

  for (const slug of [...strongSlugs, ...claimsSummarySlugs]) {
    const summary = await getStagedPublicSummaryBySlug(slug);
    assert(summary);
    const hasStrongSnapshot = strongSlugs.includes(slug);
    const scene = getPolicyScenePilot(slug, summary.claims, hasStrongSnapshot, !hasStrongSnapshot);
    assert(scene, slug);
    const html = renderToStaticMarkup(React.createElement(PolicySceneHero, { scene }));
    assert.match(html, new RegExp(`data-policy-scene="${slug}"`));
    assert.match(html, hasStrongSnapshot ? /href="#student-policy-heading"/ : slug === "university-of-queensland" ? /href="https:\/\/itali\.uq\.edu\.au\/node\/11633"/ : /href="#claims"/);
    if (hasStrongSnapshot) {
      assert.doesNotMatch(html, /No reviewed student policy snapshot/);
    } else if (["university-of-queensland", "university-of-bristol", "durham-university"].includes(slug)) {
      assert.doesNotMatch(html, /No reviewed student policy snapshot/);
    } else {
      assert.match(html, /No reviewed student policy snapshot has been published yet/);
    }
    assert.equal(getPolicyScenePilot(slug, summary.claims, !hasStrongSnapshot, hasStrongSnapshot), undefined);
    assert.equal(getPolicyScenePilot(slug, [], hasStrongSnapshot, !hasStrongSnapshot), undefined);
  }

  const harvard = await getStagedPublicSummaryBySlug("harvard-university");
  assert(harvard);
  assert.equal(getPolicyScenePilot("university-of-cambridge", harvard.claims, true, false), undefined);
});

test("the pilot content version is a fixed traceable date", () => {
  assert.equal(INDEX_RECOVERY_CONTENT_VERSION, "2026-09-27");
  assert.equal(
    Number.isNaN(new Date(INDEX_RECOVERY_CONTENT_VERSION).getTime()),
    false
  );
});

test("pilot descriptions fail closed outside the strong snapshot gate", async () => {
  const harvard = await getStagedPublicSummaryBySlug("harvard-university");
  assert(harvard);
  const harvardReviewed = reviewedClaimsOf(harvard.claims).length;

  // Non-pilot pages keep the generic description path (undefined here).
  assert.equal(
    buildIndexRecoveryDescription({
      slug: "university-of-cambridge",
      basisVerified: true,
    reviewedClaimCount: 1,
      officialSourceCount: 1
    }),
    undefined
  );

  // Strong pilot: the reviewed snapshot summary is quoted.
  const strong = buildIndexRecoveryDescription({
    slug: "harvard-university",
    strongSnapshotSummary:
      "Check your Harvard course or unit policy before using AI.",
    basisVerified: true,
    reviewedClaimCount: harvardReviewed,
    officialSourceCount: harvard.officialSources.length
  });
  assert(strong);
  assert.match(strong, /^Check your Harvard course or unit policy/);
  assert.match(strong, /Reviewed 30 policy claims from 13 official sources\.$/);

  // Claims-summary pilot: curated text, never a snapshot claim.
  const claimsOnly = buildIndexRecoveryDescription({
    slug: "university-of-bristol",
    basisVerified: true,
    reviewedClaimCount: 4,
    officialSourceCount: 4
  });
  assert(claimsOnly);
  assert.match(claimsOnly, /^Bristol's taught-programme guidance/);
  assert.doesNotMatch(claimsOnly, /snapshot/i);
  assert.match(claimsOnly, /Reviewed 4 policy claims from 4 official sources\.$/);

  // A stale or unpublished snapshot must not feed the description.
  const notStrong = buildIndexRecoveryDescription({
    slug: "harvard-university",
    strongSnapshotSummary: undefined,
    basisVerified: true,
    reviewedClaimCount: 1,
    officialSourceCount: 1
  });
  assert.equal(notStrong, undefined);
});

test("pilot titles carry the university theme, non-pilot pages get none", () => {
  assert.equal(
    buildIndexRecoveryTitle("University of Oxford", "university-of-oxford", true),
    "University of Oxford AI policy: assessment declarations and thesis rules"
  );
  assert.equal(
    buildIndexRecoveryTitle("University of Cambridge", "university-of-cambridge"),
    undefined
  );
});

test("pilot hreflang declares only reviewed locales; other paths unchanged", () => {
  const restricted = getLocalizedAlternates(
    "/universities/harvard-university",
    "en",
    { restrictLocales: ["en"] }
  );
  assert.deepEqual(Object.keys(restricted.languages ?? {}), [
    "en",
    "x-default"
  ]);
  assert.equal(
    String(restricted.canonical),
    "http://localhost:3000/universities/harvard-university"
  );
  assert.equal(
    restricted.languages?.["x-default"],
    "http://localhost:3000/universities/harvard-university"
  );

  const restrictedLocale = getLocalizedAlternates(
    "/universities/harvard-university",
    "zh",
    { restrictLocales: ["en"] }
  );
  assert.deepEqual(Object.keys(restrictedLocale.languages ?? {}), [
    "en",
    "x-default"
  ]);
  assert.equal(
    String(restrictedLocale.canonical),
    "http://localhost:3000/zh/universities/harvard-university"
  );

  // Non-pilot paths keep the full language set.
  const full = getLocalizedAlternates("/universities/university-of-cambridge", "en");
  assert.deepEqual(Object.keys(full.languages ?? {}), [
    "en",
    "zh",
    "fr",
    "pl",
    "es",
    "nl",
    "ms",
    "x-default"
  ]);

  assert.deepEqual(
    getIndexRecoveryPilotLocaleRestriction("university-of-oxford"),
    ["en"]
  );
  assert.equal(
    getIndexRecoveryPilotLocaleRestriction("university-of-cambridge"),
    undefined
  );

  // The 10 extension universities retain full upstream multilingual hreflang eligibility
  const extensionSlugs = [
    "university-of-surrey",
    "imperial-college-london",
    "adelaide-university",
    "de-la-salle-university",
    "ubc",
    "university-of-queensland",
    "university-of-johannesburg",
    "anu",
    "durham-university",
    "university-of-auckland"
  ] as const;

  for (const slug of extensionSlugs) {
    assert.equal(
      getIndexRecoveryPilotLocaleRestriction(slug),
      undefined,
      `${slug} must not be restricted to English-only hreflang`
    );
    const alternates = getLocalizedAlternates(`/universities/${slug}`, "en");
    assert.deepEqual(
      Object.keys(alternates.languages ?? {}),
      ["en", "zh", "fr", "pl", "es", "nl", "ms", "x-default"],
      `${slug} must retain full 7-locale hreflang alternates`
    );
  }
});

test("snapshot-dimension grouping keeps every reviewed claim exactly once", async () => {
  const summary = await getStagedPublicSummaryBySlug("university-of-oxford");
  const loaded = await getLoadedPolicySnapshotBySlug("university-of-oxford");
  assert(summary);
  assert(loaded);
  assert.equal(loaded.validation.effectiveStatus, "strong");

  const reviewed = reviewedClaimsOf(summary.claims);
  const groups = groupReviewedClaimsBySnapshotDimensions(
    reviewed,
    loaded.snapshot
  );

  const dimensionKeys = groups
    .filter((group) => group.key !== "additional")
    .map((group) => group.key);
  const expectedOrder = STUDENT_SNAPSHOT_DIMENSION_ORDER.filter((key) =>
    dimensionKeys.includes(key)
  );
  assert.deepEqual(dimensionKeys, expectedOrder);

  // Oxford binds clm-university-of-oxford-ai-assessment-student-duties to
  // coursework, exams, and disclosure; it must render only once.
  const appearances = groups.flatMap((group) =>
    group.claims.filter(
      (claim) => claim.id === "clm-university-of-oxford-ai-assessment-student-duties"
    )
  );
  assert.equal(appearances.length, 1);
  assert.equal(
    groups.find((group) =>
      group.claims.some(
        (claim) =>
          claim.id === "clm-university-of-oxford-ai-assessment-student-duties"
      )
    )?.key,
    "coursework"
  );

  const groupedCount = groups.reduce(
    (total, group) => total + group.claims.length,
    0
  );
  assert.equal(groupedCount, reviewed.length);

  const ids = groups.flatMap((group) => group.claims.map((claim) => claim.id));
  assert.equal(new Set(ids).size, ids.length);
});

test("claimType grouping for snapshot-less pilots loses nothing", async () => {
  const summary = await getStagedPublicSummaryBySlug("deakin-university");
  assert(summary);
  const reviewed = reviewedClaimsOf(summary.claims);
  const groups = groupReviewedClaimsByClaimType(reviewed);

  assert.deepEqual(
    groups.map((group) => group.key),
    ["academic_integrity", "teaching", "privacy", "research", "ai_tool_treatment"]
  );
  assert.equal(
    groups.reduce((total, group) => total + group.claims.length, 0),
    reviewed.length
  );
  assert.equal(reviewed.length, 8);
});

test("related-university selection is deterministic, existing, and self-free", async () => {
  const catalog = await getStagedCatalogUniversities();
  const summaries = await getStagedPublicSummaries();

  const first = selectRelatedUniversities("edinburgh", catalog, summaries);
  const second = selectRelatedUniversities("edinburgh", catalog, summaries);
  assert.deepEqual(first, second);
  assert.equal(first.length, 5);
  assert.equal(
    first.some((university) => university.slug === "edinburgh"),
    false
  );
  for (const university of first) {
    assert(
      catalog.some((item) => item.slug === university.slug),
      `${university.slug} must exist in the catalog`
    );
    assert.equal(university.country, "United Kingdom");
  }

  const nusRelated = selectRelatedUniversities(
    "national-university-of-singapore",
    catalog,
    summaries
  );
  assert.equal(nusRelated.length, 5);
  assert.equal(
    nusRelated.some((university) => university.slug === "national-university-of-singapore"),
    false
  );
  for (const university of nusRelated) {
    assert(
      catalog.some((item) => item.slug === university.slug),
      `${university.slug} must exist in the catalog`
    );
  }
});

test("grouped claims and related links render in server HTML with anchors", async () => {
  const summary = await getStagedPublicSummaryBySlug("university-of-oxford");
  const loaded = await getLoadedPolicySnapshotBySlug("university-of-oxford");
  assert(summary);
  assert(loaded);
  const reviewed = reviewedClaimsOf(summary.claims);
  const groups = groupReviewedClaimsBySnapshotDimensions(
    reviewed,
    loaded.snapshot
  );

  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  const html = renderToStaticMarkup(
    React.createElement(UniversityClaimGroups, {
      entitySlug: "university-of-oxford",
      groups,
      locale: "en"
    })
  );

  assert.match(html, /data-claim-group="coursework"/);
  assert.match(html, /data-claim-group="additional"/);
  assert.match(html, /id="claim-clm-university-of-oxford-ai-assessment-student-duties"/);
  assert.match(html, /data-analytics-event="official_source_click"/);
  assert.match(html, /Coursework &amp; assignments/);
  assert.match(html, /Additional reviewed claims/);

  const relatedHtml = renderToStaticMarkup(
    React.createElement(RelatedUniversities, {
      universities: [
        { slug: "university-of-cambridge", name: "University of Cambridge", country: "United Kingdom" },
        { slug: "imperial-college-london", name: "Imperial College London", country: "United Kingdom" }
      ]
    })
  );
  assert.match(relatedHtml, /href="\/universities\/university-of-cambridge"/);
  assert.match(relatedHtml, /href="\/universities\/imperial-college-london"/);
  assert.match(relatedHtml, /these links do not imply the same rules/);
});

test("the bristol fixture still validates and is not a published pilot snapshot", async () => {
  const fixturePath = path.join(
    process.cwd(),
    "examples",
    "fixtures",
    "policy-snapshot-v1-bristol.json"
  );
  const snapshot: PolicySnapshot = policySnapshotSchema.parse(
    JSON.parse(await readFile(fixturePath, "utf8"))
  );
  const loaded = await getLoadedPolicySnapshotBySlug("university-of-bristol");
  assert.equal(loaded, undefined);

  const summary = await getStagedPublicSummaryBySlug("university-of-bristol");
  assert(summary);
  const reviewed = reviewedClaimsOf(summary.claims);
  const groups = groupReviewedClaimsBySnapshotDimensions(
    reviewed,
    snapshot
  );
  // Bristol's live claims carry no ids, so the grouping is fail-closed:
  // nothing is treated as dimension evidence and everything stays reviewable.
  assert.equal(
    groups.reduce((total, group) => total + group.claims.length, 0),
    reviewed.length
  );
});


test("authored content fails closed when reviewed claims or evidence change", async () => {
  for (const slug of INDEX_RECOVERY_PILOT_SLUGS) {
    const summary = await getStagedPublicSummaryBySlug(slug);
    assert(summary);
    assert.equal(hasCurrentIndexRecoveryBasis(slug, summary.claims), true, slug);
    const claims = structuredClone(summary.claims);
    const reviewed = claims.find(c => ["agent_reviewed", "human_reviewed"].includes(c.reviewState))!;
    reviewed.lastCheckedAt = "2026-10-01T00:00:00Z";
    assert.equal(hasCurrentIndexRecoveryBasis(slug, claims), true);
    reviewed.claimText += " Changed policy.";
    assert.equal(hasCurrentIndexRecoveryBasis(slug, claims), false);
    const downgraded = structuredClone(summary.claims);
    downgraded.find(c => ["agent_reviewed", "human_reviewed"].includes(c.reviewState))!.reviewState = "needs_review";
    assert.equal(hasCurrentIndexRecoveryBasis(slug, downgraded), false);
    const evidenceChanged = structuredClone(summary.claims);
    evidenceChanged.find(c => ["agent_reviewed", "human_reviewed"].includes(c.reviewState) && c.evidence.length)!.evidence[0].sourceSnapshotHash = "changed";
    assert.equal(hasCurrentIndexRecoveryBasis(slug, evidenceChanged), false);
    assert.equal(hasCurrentIndexRecoveryBasis(slug, []), false);
    assert.equal(buildIndexRecoveryTitle(slug, slug, false), undefined);
    assert.equal(buildIndexRecoveryDescription({slug, basisVerified: false, reviewedClaimCount: 4, officialSourceCount: 4}), undefined);
    assert.equal(buildIndexRecoveryDescription({slug, basisVerified: true, reviewedClaimCount: 0, officialSourceCount: 4}), undefined);
  }
});

test("Bristol metadata retains the assessment permission exception", () => {
  const description = buildIndexRecoveryDescription({slug: "university-of-bristol", basisVerified: true, reviewedClaimCount: 4, officialSourceCount: 4});
  assert.match(description!, /unless assessment instructions allow more comprehensive use/);
});

test("content dates use substantive changes and reviewed snapshot generation", () => {
  assert.equal(indexRecoveryContentDate([undefined, "invalid", "2026-07-01"]).toISOString(), "2026-09-27T00:00:00.000Z");
  assert.equal(indexRecoveryContentDate(["2026-09-20T01:00:00Z"]).toISOString(), "2026-09-27T00:00:00.000Z");
  assert.equal(indexRecoveryContentDate(["2026-09-20"], "2026-09-28T01:00:00Z").toISOString(), "2026-09-28T01:00:00.000Z");
});


test("check-only updates never refresh pilot content dates", () => {
  const before = [{lastChangedAt: "2026-07-01", lastCheckedAt: "2026-09-01"}];
  const after = [{lastChangedAt: "2026-07-01", lastCheckedAt: "2026-10-01"}];
  assert.equal(indexRecoveryRecordDate(before).toISOString(), indexRecoveryRecordDate(after).toISOString());
  assert.equal(indexRecoveryRecordDate([{lastCheckedAt: "2026-10-01"}]).toISOString(), "2026-09-27T00:00:00.000Z");
  assert.equal(indexRecoveryRecordDate([{lastChangedAt: "2026-09-25", lastCheckedAt: "2026-10-01"}]).toISOString(), "2026-09-27T00:00:00.000Z");
});

test("pilot pages have evidence-linked images and disclose snapshot-less scope", async () => {
  const noSnapshotSlugs = new Set(["university-of-bristol", "manchester", "edinburgh", "deakin-university", "university-of-surrey", "university-of-queensland", "university-of-johannesburg", "anu", "durham-university"]);
  const expectedCardCounts: Record<string, number> = {
    "harvard-university": 2,
    "unsw-sydney": 4,
    "university-of-sydney": 3,
    "national-university-of-singapore": 2,
    "university-of-oxford": 4,
    "utrecht-university": 2,
    "university-of-bristol": 3,
    manchester: 4,
    edinburgh: 4,
    "deakin-university": 3,
    "university-of-surrey": 2,
    "imperial-college-london": 3,
    "adelaide-university": 3,
    "de-la-salle-university": 3,
    ubc: 4,
    "university-of-queensland": 2,
    "university-of-johannesburg": 2,
    anu: 4,
    "durham-university": 3,
    "university-of-auckland": 3
  };
  for (const slug of INDEX_RECOVERY_PILOT_SLUGS) {
    const summary = await getStagedPublicSummaryBySlug(slug);
    assert(summary);
    const strong = !noSnapshotSlugs.has(slug);
    const scene = getPolicyScenePilot(slug, summary.claims, strong, !strong);
    assert(scene);
    assert.equal(scene.storyCards?.length, expectedCardCounts[slug], slug);
    assert.equal(scene.scenarioChecks, undefined);
    assert.equal(Boolean(scene.quickGuide), true, slug);
    const quickGuideImages = scene.quickGuide
      ? [scene.quickGuide.do.artworkSrc, scene.quickGuide.dont.artworkSrc]
      : [];
    for (const imagePath of [scene.artworkSrc, ...scene.storyCards!.map((card) => card.artworkSrc), ...quickGuideImages]) {
      const bytes = await readFile(path.join(process.cwd(), "apps/web/public", imagePath));
      assert.equal(bytes[0], 0xff, imagePath);
      assert.equal(bytes[1], 0xd8, imagePath);
      assert(bytes.length < 700_000, `${imagePath} is too large for the pilot`);
    }
    const storyHtml = renderToStaticMarkup(React.createElement(PolicySceneStory, { scene }));
    assert.match(storyHtml, /aria-label="Illustrated policy guide"/);
    const reviewedClaims = reviewedClaimsOf(summary.claims);
    const loaded = strong ? await getLoadedPolicySnapshotBySlug(slug) : undefined;
    const policyHtml = strong && loaded
      ? renderToStaticMarkup(React.createElement(StudentPolicySnapshot, {
          claims: reviewedClaims,
          entitySlug: slug,
          role: "student",
          scene,
          snapshot: loaded.snapshot
        }))
      : [
          scene.quickGuide ? renderToStaticMarkup(React.createElement(PolicySceneGallery, { scene })) : "",
          renderToStaticMarkup(React.createElement(UniversityClaimGroups, {
            entitySlug: slug,
            groups: groupReviewedClaimsByClaimType(reviewedClaims),
            locale: "en",
            scene: scene.quickGuide ? undefined : scene,
            collapsible: Boolean(scene.quickGuide)
          }))
        ].join("");
    for (const card of scene.storyCards!) {
      if (card.evidenceHref.startsWith("https://")) {
        assert.match(card.evidenceHref, /^https:\/\/(www\.uu\.nl|ctlt\.nus\.edu\.sg|itali\.uq\.edu\.au|registrar\.gse\.harvard\.edu|old\.dlsu\.edu\.ph|www\.bristol\.ac\.uk|www\.auckland\.ac\.nz)\//);
        if (strong) assert(card.placement && loaded?.snapshot.dimensions.some((dimension) => dimension.key === card.placement), `${slug}: external source card has no snapshot placement`);
      } else {
        const target = card.evidenceHref.slice(1);
        if (strong) assert(loaded?.snapshot.dimensions.some((dimension) => `snapshot-${dimension.key}` === target), `${slug}: ${target}`);
        else assert(reviewedClaims.some((claim) => `claim-${claim.id}` === target), `${slug}: ${target}`);
      }
      assert(policyHtml.includes(`id="${policySceneCardId(card)}"`), `${slug}: card missing from policy section`);
      assert(policyHtml.includes(`href="${card.evidenceHref}"`), `${slug}: evidence link missing`);
      if (card.audience !== "research") assert(storyHtml.includes(`#${policySceneCardId(card)}`));
    }
    if (strong) {
      assert(!scene.snapshotNotice);
    } else if (["university-of-queensland", "university-of-bristol", "durham-university"].includes(slug)) {
      assert.equal(scene.claimsOnly, true);
      assert.equal(scene.snapshotNotice, undefined);
      assert.match(scene.quickGuide?.scopeNote ?? "", /without a complete reviewed student snapshot|not a complete reviewed student snapshot|no reviewed student-policy snapshot/);
    } else {
      assert.equal(scene.snapshotNotice, "No reviewed student policy snapshot has been published yet.");
      const heroHtml = renderToStaticMarkup(React.createElement(PolicySceneHero, { scene }));
      assert.match(heroHtml, /No reviewed student policy snapshot has been published yet/);
    }
    if (scene.quickGuide) {
      const guideHtml = strong ? policyHtml : renderToStaticMarkup(React.createElement(PolicyQuickGuide, { scene }));
      assert.match(guideHtml, /Policy at a glance/);
      assert.match(guideHtml, /href="#claims"/);
      assert.match(guideHtml, /href="#sources"/);
      for (const panel of [scene.quickGuide.do, scene.quickGuide.dont]) {
        assert.equal(panel.checks.length, 3);
        for (const check of panel.checks) {
          if (check.evidenceHref.startsWith("https://")) {
            assert.match(check.evidenceHref, /^https:\/\//);
          } else {
            const target = check.evidenceHref.slice(1);
            if (strong) assert(loaded?.snapshot.dimensions.some((dimension) => `snapshot-${dimension.key}` === target), `${slug}: ${target}`);
            else assert(reviewedClaims.some((claim) => `claim-${claim.id}` === target), `${slug}: ${target}`);
          }
          assert(guideHtml.includes(`href="${check.evidenceHref}"`));
        }
      }
      if (!strong) assert.match(policyHtml, /<details class="claim-dimension-group__details"/);
    }
  }
  const harvard = await getStagedPublicSummaryBySlug("harvard-university");
  assert(harvard);
  const harvardScene = getPolicyScenePilot("harvard-university", harvard.claims, true, false);
  assert.equal(harvardScene?.storyCards?.[0]?.placement, "coursework");
  assert.equal(harvardScene?.storyCards?.[0]?.evidenceHref, "https://registrar.gse.harvard.edu/learning/policies-forms/ai-policy");
  assert(harvardScene?.storyCards?.some((card) => card.artworkSrc === "/assets/policy-scenes/harvard-hgse.jpg"));
  const unsw = await getStagedPublicSummaryBySlug("unsw-sydney");
  assert(unsw);
  const unswScene = getPolicyScenePilot("unsw-sydney", unsw.claims, true, false);
  assert(unswScene?.storyCards?.some((card) => card.evidenceHref === "#snapshot-approved_tools"));
  const manchesterForStudent = await getStagedPublicSummaryBySlug("manchester");
  assert(manchesterForStudent);
  assert(manchesterForStudent.claims.some((claim) => claim.id === "CL-010" && (claim.reviewState === "agent_reviewed" || claim.reviewState === "human_reviewed")));
  const manchesterStudentScene = getPolicyScenePilot("manchester", manchesterForStudent.claims, false, true);
  assert(manchesterStudentScene?.storyCards?.some((card) => card.evidenceHref === "#claim-CL-010"));
  const oxford = await getStagedPublicSummaryBySlug("university-of-oxford");
  assert(oxford);
  const oxfordScene = getPolicyScenePilot("university-of-oxford", oxford.claims, true, false);
  assert(oxfordScene?.storyCards?.some((card) => card.evidenceHref === "#snapshot-research_publication"));
  const edinburgh = await getStagedPublicSummaryBySlug("edinburgh");
  assert(edinburgh);
  const edinburghScene = getPolicyScenePilot("edinburgh", edinburgh.claims, false, true);
  assert(edinburghScene?.storyCards?.some((card) => card.evidenceHref === "#claim-claim-edinburgh-006"));
});
