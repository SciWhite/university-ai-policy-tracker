import assert from "node:assert/strict";
import test from "node:test";

import { getCatalogUniversities, getPublicUniversitySummaryBySlug } from "../apps/web/lib/catalog";
import { universityReadingBasis } from "../apps/web/lib/university-reading-basis";
import { universityReadingIndexLocales, universityReadingMetadata } from "../apps/web/lib/university-reading-metadata";
import { policyV6Tier } from "../apps/web/lib/policy-v6-tier";
import { schoolSwitcherLocales } from "../apps/web/lib/school-languages";
import { buildSitemapSection } from "../apps/web/lib/sitemap-sections";
import { loadSelectedChangeEventIndex } from "../apps/web/lib/change-events-api";
import { getKnownReleaseIds } from "../apps/web/lib/release-diffs";
import { publishedV6RevisionIds } from "../apps/web/lib/policy-v6-published";
import { getEntityAliasResolver } from "../apps/web/lib/entity-aliases";

process.env.UAPT_V6_PUBLISHED_PAGES = "1";

// Base-tier schools are indexed in English and Simplified Chinese (the content languages,
// apps/web/lib/content-locales.ts), plus their country language only with a complete accepted
// reading translation. Since 2026-11-22 a legacy UI locale (fr, pl, es, nl, ms) no longer
// qualifies by itself: those pages showed English prose in a foreign UI. No reading package is
// loaded locally, so every case is en + zh. Robots, hreflang, the sitemap and the language
// switcher read the same decision.
const cases: Array<[string, string[]]> = [
  ["universite-paris-cite", ["en", "zh"]],
  ["universite-de-montreal", ["en", "zh"]],
  ["jagiellonian-university", ["en", "zh"]],
  ["arizona-state-university", ["en", "zh"]]
];

async function indexLocales(slug: string, onlyLocale?: string) {
  const summary = await getPublicUniversitySummaryBySlug(slug);
  assert.ok(summary, slug);
  const basis = universityReadingBasis(slug, summary) ?? { recordSha256: "", originalEvidenceSha256: "" };
  return { summary, basis, locales: await universityReadingIndexLocales(slug, basis, summary, onlyLocale as never) };
}

test("base-tier schools index en and zh; a country language needs its reading package", async () => {
  for (const [slug, expected] of cases) {
    assert.equal(policyV6Tier(slug), "base", slug);
    assert.deepEqual((await indexLocales(slug)).locales, expected, slug);
    for (const locale of ["zh", "fr", "pl", "ko"]) {
      assert.deepEqual((await indexLocales(slug, locale)).locales, expected.filter(item => item === "en" || item === locale), `${slug} ${locale}`);
    }
  }
});

test("a non-legacy country language also needs a complete reading translation", async () => {
  const korean = (await getCatalogUniversities()).find(school => school.country === "South Korea" && policyV6Tier(school.slug) === "base");
  assert.ok(korean);
  assert.deepEqual((await indexLocales(korean.slug)).locales, ["en", "zh"]);
  assert.deepEqual(schoolSwitcherLocales(korean, (await indexLocales(korean.slug)).locales), ["en", "zh"]);
});

test("robots, hreflang and the switcher agree for base-tier schools", async () => {
  for (const [slug, expected] of cases) {
    const { summary, basis, locales } = await indexLocales(slug);
    const school = (await getCatalogUniversities()).find(row => row.slug === slug)!;
    assert.deepEqual(schoolSwitcherLocales(school, locales), expected, slug);
    for (const locale of ["en", "zh", "fr", "pl", "es", "ko", "ja"] as const) {
      const metadata = await universityReadingMetadata(slug, `/universities/${slug}`, locale, basis, summary);
      const indexed = expected.includes(locale);
      assert.equal((metadata.robots as { index?: boolean }).index, indexed, `${slug} ${locale}`);
      const languages = Object.keys(metadata.alternates?.languages ?? {});
      assert.deepEqual(languages, indexed ? [...expected, "x-default"] : [], `${slug} ${locale}`);
    }
  }
});

test("full-tier schools keep the reviewed registry", async () => {
  // No registry is loaded locally, so a full school stays English-only.
  assert.equal(policyV6Tier("harvard-university"), "full");
  assert.deepEqual((await indexLocales("harvard-university")).locales, ["en"]);
});

test("the rankings index is listed in the content languages only", async () => {
  assert.ok((await buildSitemapSection("core")).some(entry => new URL(entry.url).pathname === "/rankings"));
  assert.ok((await buildSitemapSection("zh")).some(entry => new URL(entry.url).pathname === "/zh/rankings"));
  for (const locale of ["fr", "pl", "es", "nl", "ms", "ja"] as const) {
    const entries = await buildSitemapSection(locale);
    // A UI-only locale section lists native-language school pages only (none locally).
    assert.ok(entries.every(entry => /^\/[A-Za-z-]+\/universities\/[a-z0-9-]+$/.test(new URL(entry.url).pathname)), locale);
  }
});

test("the changes sitemap lists every release, history event and school history from content", async () => {
  const paths = new Set((await buildSitemapSection("changes")).map(entry => new URL(entry.url).pathname));
  const aliases = await getEntityAliasResolver();
  for (const releaseId of [...await getKnownReleaseIds(), ...publishedV6RevisionIds()]) assert.ok(paths.has(`/changes/${releaseId}`), releaseId);
  const rows = (await loadSelectedChangeEventIndex())?.rows ?? [];
  assert.ok(rows.length > 900);
  for (const row of rows) {
    if (aliases.slugAliases.has(row.slug)) continue;
    assert.ok(paths.has(row.url), row.url);
    assert.ok(paths.has(`/changes/${row.slug}`), row.slug);
  }
  assert.ok(paths.has("/changes/v6-target-r7-candidate-20261021"));
  // Event-only revisions without release records have no release page.
  assert.ok(!paths.has("/changes/qs20-24-v6-r3-20261020"));
  assert.ok(paths.has("/zh/changes/paris-northwestern-v6-r1-20261022/northwestern-university"));
  // Localized change pages exist in zh only; /<uiLocale>/changes/... are 301s.
  for (const locale of ["fr", "pl", "es", "nl", "ms"]) assert.ok(![...paths].some(path => path.startsWith(`/${locale}/`)), locale);
  assert.ok(![...paths].some(path => /^\/zh\/changes\/(?!paris-northwestern-v6-r1-20261022\/)/.test(path)));
  // Largest live group that R1 had dropped.
  assert.ok([...paths].filter(path => path.startsWith("/changes/public-release-20260715-005/")).length >= 300);
  for (const path of paths) {
    const segments = path.split("/").slice(2);
    assert.ok(segments.every(segment => !aliases.slugAliases.has(segment)), `alias ${path}`);
  }
});
