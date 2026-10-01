import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as unknown as { React: typeof React }).React = React;

import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime.js";
import { isHomeV4Preview } from "../apps/web/lib/home-v4-preview";
import { isHomeV4GuideEligible } from "../apps/web/lib/home-v4-guides";
import { getHomeV4Copy } from "../apps/web/lib/home-v4-copy";
import { preservePolicyReferenceSearch } from "../apps/web/lib/policy-reference-preview";
import { SUPPORTED_LOCALES, type SupportedLocale } from "../apps/web/lib/i18n";
import HomePage, { generateMetadata } from "../apps/web/app/(default)/page";
import { HomeV4View } from "../apps/web/components/home-v4-view";
import { getStaticUniversityIndexRecords } from "../apps/web/lib/university-index-records";
import { getStagedPublicSummaryBySlug } from "../apps/web/lib/staged-public-data";
import { getLoadedPolicySnapshotBySlug } from "../apps/web/lib/policy-snapshots";
import { isStrongStudentSnapshot } from "../apps/web/components/student-policy-snapshot";

test("production preview gate fails closed in production and for non-v4 values", () => {
  assert.equal(isHomeV4Preview("home-v4", "development"), true);
  assert.equal(isHomeV4Preview("home-v4", "production"), false);
  assert.equal(isHomeV4Preview("home-v4", "test"), false);
  assert.equal(isHomeV4Preview("other", "development"), false);
  assert.equal(isHomeV4Preview(undefined, "development"), false);
  assert.equal(isHomeV4Preview(null, "development"), false);
});

test("default SEO and metadata promote V4 to default in production and support legacy layout", async () => {
  // Published V4 metadata is default without query parameter
  const defaultMeta = await generateMetadata();
  assert.equal(defaultMeta.robots, undefined);
  assert.equal(defaultMeta.title, "Find your university’s AI policy | University AI Policy Tracker");
  assert.equal(defaultMeta.description, "Explore guidance for assignments, disclosure and data safety, with links to official university sources.");
  assert(defaultMeta.alternates);
  assert(String(defaultMeta.alternates.canonical).endsWith("/"));

  // Explicit legacy layout fallback
  const legacyMeta = await generateMetadata({
    searchParams: Promise.resolve({ layout: "legacy" })
  });
  assert.equal(legacyMeta.robots, undefined);
  assert.match(String(legacyMeta.title), /University AI Policy Database/);
});

test("home-v4 metadata sets robots noindex nofollow and retains canonical hreflangs", async () => {
  for (const locale of SUPPORTED_LOCALES) {
    const copy = getHomeV4Copy(locale);
    // Explicitly simulate development environment check
    assert(copy.heroHeading.length > 0);
    assert(copy.heroSubtitle.length > 0);
    assert(copy.metaTitle.length > 0);
    assert(copy.metaDescription.length > 0);
  }

  // Force NODE_ENV to development temporarily for generateMetadata test
  const originalEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "development";
    const v4Meta = await generateMetadata({
      searchParams: Promise.resolve({ layout: "home-v4" })
    });
    assert.deepEqual(v4Meta.robots, { index: false, follow: false });
    assert.equal(v4Meta.title, "Find your university’s AI policy | University AI Policy Tracker");
    assert.equal(v4Meta.description, "Explore guidance for assignments, disclosure and data safety, with links to official university sources.");
    assert(v4Meta.alternates);
    assert(String(v4Meta.alternates.canonical).endsWith("/"));
    assert(v4Meta.alternates.languages);

    // Check localized metadata on zh
    const zhMeta = await generateMetadata({
      params: Promise.resolve({ locale: "zh" }),
      searchParams: Promise.resolve({ layout: "home-v4" })
    });
    assert.deepEqual(zhMeta.robots, { index: false, follow: false });
    assert.equal(zhMeta.title, "查找你大学的 AI 使用政策 | 大学 AI 政策追踪");
    assert.equal(zhMeta.description, "查看作业、AI 声明与数据保护相关规定，并核对大学官方来源。");
    assert(String(zhMeta.alternates?.canonical).endsWith("/zh"));
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test("HomeV4View renders all 7 UI sections with SSR content across all 7 locales", async () => {
  const universities = await getStaticUniversityIndexRecords();
  const claimCount = universities.reduce((acc, u) => acc + u.claimCount, 0);
  const sourceCount = universities.reduce((acc, u) => acc + u.sourceCount, 0);
  const recentRecords = universities
    .filter((record) => record.lastCheckedAt && record.reviewedClaimCount > 0)
    .sort((a, b) => (b.lastCheckedAt ?? "").localeCompare(a.lastCheckedAt ?? "") || a.slug.localeCompare(b.slug))
    .slice(0, 5);

  for (const locale of SUPPORTED_LOCALES) {
    const copy = getHomeV4Copy(locale);
    const html = renderToStaticMarkup(
      <PathnameContext.Provider value={locale === "en" ? "/" : `/${locale}`}>
        <HomeV4View
          locale={locale}
          universities={universities}
          claimCount={claimCount}
          sourceCount={sourceCount}
          recentRecords={recentRecords}
          eligibleGuideSlugs={["stanford-university", "university-of-bristol", "national-university-of-singapore"]}
          isPreview={true}
        />
      </PathnameContext.Provider>
    );

    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");

    // 1. Scoped container and no data-i18n mangling
    assert(html.includes('class="home-v4"'), `${locale} missing .home-v4`);
    assert(html.includes('data-i18n="preserve"'), `${locale} missing data-i18n="preserve"`);

    // 2. Section 1: Hero, localized title, visible label, search form action
    assert(html.includes(esc(copy.heroHeading)), `${locale} missing hero heading`);
    assert(html.includes(esc(copy.heroSubtitle)), `${locale} missing hero subtitle`);
    assert(html.includes(esc(copy.searchLabel)), `${locale} missing visible search label`);
    assert(html.includes(`action="${locale === "en" ? "/search" : `/${locale}/search`}"`), `${locale} form action not localized`);
    assert(html.includes(esc(copy.browseAllUniversities)), `${locale} missing browse all universities`);
    assert(html.includes("/assets/home-v4/library-study-v1.webp"), `${locale} missing library-study-v1.webp hero art`);
    const expectedCoverage = copy.coverageNote(
      new Intl.NumberFormat(locale).format(universities.length),
      new Intl.NumberFormat(locale).format(claimCount)
    );
    assert(html.includes(esc(expectedCoverage)), `${locale} missing coverage note: ${expectedCoverage}`);

    // 3. Section 2: Six question-topic links
    assert.equal(copy.topics.length, 6, `${locale} should have 6 topics`);
    for (const topic of copy.topics) {
      assert(html.includes(esc(topic.title)), `${locale} missing topic: ${topic.title}`);
      assert(html.includes(topic.href), `${locale} missing topic href: ${topic.href}`);
    }

    // 4. Section 3: Three guide examples with thumbnails and scopes
    assert.equal(copy.guides.length, 3, `${locale} should have 3 guides`);
    for (const guide of copy.guides) {
      assert(html.includes(guide.slug), `${locale} missing guide: ${guide.slug}`);
      assert(html.includes(guide.thumbSrc), `${locale} missing thumbnail: ${guide.thumbSrc}`);
      assert(html.includes(esc(guide.scopeNote)), `${locale} missing scope note: ${guide.scopeNote}`);
    }
    // Translated scope paragraphs must not have incorrect hardcoded lang="en" in non-English locales
    if (locale !== "en") {
      assert(!html.includes('lang="en"'), `${locale} should not have hardcoded lang="en" on translated scope`);
    }

    assert(html.includes(esc(copy.recentChecksHeading)), `${locale} missing recent checks heading`);
    assert(html.includes("/changes"), `${locale} missing link to changes`);
    assert(!html.includes(">JSON</a>"), `${locale} recent checks should not have JSON button per row`);
    for (const record of recentRecords) {
      if (record.country === "Chile" && locale === "zh") {
        assert(html.includes("智利"), "Chile must be localized to 智利 in Chinese Recent Checks");
        assert(!html.includes(">Chile<"), "Unlocalized 'Chile' must not appear in Chinese Recent Checks");
      }
    }


    // 6. Section 4: Regions & Tools side column
    assert(html.includes(esc(copy.regionsAndToolsHeading)), `${locale} missing regions & tools heading`);
    assert(html.includes(esc(copy.regionsGroupTitle)), `${locale} missing regionsGroupTitle`);
    assert(html.includes(esc(copy.toolsGroupTitle)), `${locale} missing toolsGroupTitle`);
    assert(html.includes(esc(copy.institutionalDirectoriesTitle)), `${locale} missing institutionalDirectoriesTitle`);
    assert(html.includes("/regions/united-states"), `${locale} missing US link`);
    assert(html.includes(esc(copy.unitedStatesLabel)), `${locale} missing unitedStatesLabel`);
    assert(html.includes("/regions/united-kingdom"), `${locale} missing UK link`);
    assert(html.includes(esc(copy.unitedKingdomLabel)), `${locale} missing unitedKingdomLabel`);
    assert(!html.includes("/regions/australia"), `${locale} must not contain 404 australia link`);
    assert(!html.includes("/regions/canada"), `${locale} must not contain 404 canada link`);
    assert(html.includes("/tools"), `${locale} missing tools link`);
    assert(html.includes("/rankings"), `${locale} missing rankings link`);
    assert(html.includes(esc(copy.rankingsNote)), `${locale} missing rankings secondary note`);

    // 7. Section 5: Sources, methodology, citation, open datasets & visible FAQ
    assert(html.includes(esc(copy.openDataHeading)), `${locale} missing open data heading`);
    assert(html.includes("/sources"), `${locale} missing sources link`);
    assert(html.includes("/methodology"), `${locale} missing methodology link`);
    assert(html.includes("/citation"), `${locale} missing citation link`);
    assert(html.includes("/datasets"), `${locale} missing datasets link`);
    assert(html.includes("/api-reference"), `${locale} missing api-reference link`);
    assert(html.includes("/mcp"), `${locale} missing mcp link`);
    assert(html.includes(esc(copy.rightsNote)), `${locale} missing rights distinction note`);

    // FAQ visible matching FAQPage JSON-LD
    assert(html.includes(esc(copy.faqHeading)), `${locale} missing FAQ heading`);
    for (const item of copy.faqItems) {
      assert(html.includes(esc(item.question)), `${locale} missing FAQ question: ${item.question}`);
      assert(html.includes(esc(item.answer)), `${locale} missing FAQ answer: ${item.answer}`);
    }

    // JSON-LD WebSite includes locale-preserving SearchAction
    const expectedPath = locale === "en"
      ? "/search?q={search_term_string}"
      : `/${locale}/search?q={search_term_string}`;
    assert(html.includes(expectedPath), `${locale} JSON-LD search target mismatch: expected ${expectedPath}`);
  }
});

test("guide eligibility validates snapshot/claims basis for Stanford, Bristol, and NUS", async () => {
  // Stanford
  const stanfordSummary = await getStagedPublicSummaryBySlug("stanford-university");
  assert(stanfordSummary, "stanfordSummary must exist");
  const stanfordSnapshot = await getLoadedPolicySnapshotBySlug("stanford-university");
  assert(stanfordSnapshot, "stanfordSnapshot must exist");
  assert.equal(
    isHomeV4GuideEligible("stanford-university", stanfordSummary.claims, isStrongStudentSnapshot(stanfordSnapshot)),
    true
  );

  // Bristol
  const bristolSummary = await getStagedPublicSummaryBySlug("university-of-bristol");
  assert(bristolSummary, "bristolSummary must exist");
  assert.equal(
    isHomeV4GuideEligible("university-of-bristol", bristolSummary.claims, false),
    true
  );

  // NUS
  const nusSummary = await getStagedPublicSummaryBySlug("national-university-of-singapore");
  assert(nusSummary, "nusSummary must exist");
  assert.equal(
    isHomeV4GuideEligible("national-university-of-singapore", nusSummary.claims, true),
    true
  );

  // Random / unverified university must be ineligible
  assert.equal(
    isHomeV4GuideEligible("aalto-university", [], false),
    false
  );
});

test("client gate dependency safety: home-v4-preview.ts has no node or crypto imports", () => {
  const previewPath = path.join(process.cwd(), "apps/web/lib/home-v4-preview.ts");
  const content = fs.readFileSync(previewPath, "utf8");
  assert(!content.includes("node:crypto"), "home-v4-preview.ts must not import node:crypto");
  assert(!content.includes("from \"node:"), "home-v4-preview.ts must not import node builtins");
  assert(!content.includes("from 'node:"), "home-v4-preview.ts must not import node builtins");
  assert(!content.includes("index-recovery-basis"), "home-v4-preview.ts must not import index-recovery-basis");
});

test("language switcher preserves home-v4 preview on homepage and does not leak to other routes", () => {
  // Homepage preserves home-v4 in development
  assert.equal(
    preservePolicyReferenceSearch("/zh", "?layout=home-v4", "development"),
    "/zh?layout=home-v4"
  );
  assert.equal(
    preservePolicyReferenceSearch("/", "?layout=home-v4", "development"),
    "/?layout=home-v4"
  );
  assert.equal(
    preservePolicyReferenceSearch("/fr", "?layout=home-v4", "development"),
    "/fr?layout=home-v4"
  );

  // Fails closed in production
  assert.equal(
    preservePolicyReferenceSearch("/zh", "?layout=home-v4", "production"),
    "/zh"
  );

  // Does NOT leak to unrelated routes (e.g. university page or theme page)
  assert.equal(
    preservePolicyReferenceSearch("/zh/universities/stanford-university", "?layout=home-v4", "development"),
    "/zh/universities/stanford-university"
  );
  assert.equal(
    preservePolicyReferenceSearch("/zh/themes/chatgpt-coursework-policy", "?layout=home-v4", "development"),
    "/zh/themes/chatgpt-coursework-policy"
  );
});

test("starter image budget is under or equal to 350KB total for hero and 3 thumbnails", () => {
  const homeV4AssetsDir = path.join(process.cwd(), "apps/web/public/assets/home-v4");
  const files = [
    "library-study-v1.webp",
    "stanford-thumb.jpg",
    "bristol-thumb.jpg",
    "nus-thumb.jpg"
  ];

  let totalBytes = 0;
  for (const file of files) {
    const filePath = path.join(homeV4AssetsDir, file);
    assert(fs.existsSync(filePath), `Asset ${file} must exist on disk`);
    const stat = fs.statSync(filePath);
    assert(stat.size > 0, `Asset ${file} must not be empty`);
    totalBytes += stat.size;
  }

  const budgetBytes = 350 * 1024; // 358,400 bytes
  assert(
    totalBytes <= budgetBytes,
    `Total asset size (${totalBytes} bytes) exceeds budget of ${budgetBytes} bytes`
  );
});

test("HomeV4View with missing or empty eligibility renders no guide cards (fail-closed)", async () => {
  const universities = await getStaticUniversityIndexRecords();
  const htmlEmpty = renderToStaticMarkup(
    <PathnameContext.Provider value="/">
      <HomeV4View
        locale="en"
        universities={universities}
        claimCount={0}
        sourceCount={0}
        recentRecords={[]}
        eligibleGuideSlugs={[]}
        isPreview={true}
      />
    </PathnameContext.Provider>
  );
  assert(!htmlEmpty.includes("home-v4__guide-card"), "empty eligibility must render zero guide cards");

  const htmlUndefined = renderToStaticMarkup(
    <PathnameContext.Provider value="/">
      <HomeV4View
        locale="en"
        universities={universities}
        claimCount={0}
        sourceCount={0}
        recentRecords={[]}
        isPreview={true}
      />
    </PathnameContext.Provider>
  );
  assert(!htmlUndefined.includes("home-v4__guide-card"), "missing eligibility must render zero guide cards");
});

