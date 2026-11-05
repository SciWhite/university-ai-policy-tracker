import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { policyV6Tier, isPolicyV6BaseTier, POLICY_V6_BASE_TIER_NOTICE } from "../apps/web/lib/policy-v6-tier";
import { publishedV6Slugs } from "../apps/web/lib/policy-v6-published-gate";
import { schoolRegionalLocale, schoolSwitcherLocales, schoolTargetLocales } from "../apps/web/lib/school-languages";
import { pageReadingLocales, readingLanguageHref, suggestedReadingLocale } from "../apps/web/lib/language-choice";
import { READING_LOCALES } from "../apps/web/lib/language-catalog";
import { getPolicyV6Data } from "../apps/web/lib/policy-v6";
import { v6DisplayRequirements } from "../apps/web/lib/university-reading-metadata";
import { getCatalogUniversities } from "../apps/web/lib/catalog";

// Production switch for published V6 pages; read at call time.
process.env.UAPT_V6_PUBLISHED_PAGES = "1";

// One of the ten locally prepared candidates: its private bundle is not
// publication-approved, so it must render as base tier from its public record.
const baseSlug = "aarhus-university";

test("every catalog school resolves to exactly one V6 tier", async () => {
  const catalog = await getCatalogUniversities();
  const published = new Set(publishedV6Slugs());
  assert.ok(catalog.length >= 800);
  for (const school of catalog) assert.equal(policyV6Tier(school.slug), published.has(school.slug) ? "full" : "base");
  assert.equal(policyV6Tier("harvard-university"), "full");
  assert.equal(policyV6Tier(baseSlug), "base");
  assert.equal(isPolicyV6BaseTier("harvard-university"), false);
  assert.equal(isPolicyV6BaseTier(baseSlug), true);
});

test("base tier data is the school's own record, without a student guide or other schools", async () => {
  const data = await getPolicyV6Data("en", baseSlug);
  assert.equal(data.baseTier, true);
  assert.equal(data.studentActionsPilot, undefined);
  assert.equal(data.studentActions, undefined);
  assert.equal(data.published, undefined);
  assert.deepEqual(data.schools.map(school => school.slug), [baseSlug]);
  const school = data.schools[0];
  assert.ok(school.topics.length === 6 && school.additionalTopics.length === 3);
  assert.ok(school.topics.every(topic => topic.basisKind === "record_analysis" || topic.basisKind === "strong_snapshot"));
  assert.notEqual(school.v6ReviewState, "agent_reviewed", "a base school must not inherit another school's V6 review");
});

test("base tier reading completeness covers the record-derived topic prose", async () => {
  const inventory = await v6DisplayRequirements(baseSlug);
  assert.equal(inventory.sourceScopeComplete, true);
  assert.ok(inventory.requirements.length > 0);
  assert.ok(inventory.requirements.every(requirement => requirement.field.startsWith("/v6/schools/")));
});

test("school languages: English, Simplified Chinese, then the country or region language", () => {
  const cases: Array<[string, string, string, string[]]> = [
    ["yonsei-university", "South Korea", "Seoul", ["en", "zh", "ko"]],
    ["peking-university", "China (Mainland)", "Beijing", ["en", "zh"]],
    ["national-taiwan-university", "Taiwan", "Taipei", ["en", "zh", "zh-Hant"]],
    ["sorbonne-university", "France", "Paris", ["en", "zh", "fr"]],
    ["universite-de-montreal", "Canada", "Montreal", ["en", "zh", "fr"]],
    ["university-of-toronto", "Canada", "Toronto", ["en", "zh"]],
    ["university-of-geneva", "Switzerland", "Geneva", ["en", "zh", "fr"]],
    ["eth-zurich", "Switzerland", "Zürich", ["en", "zh", "de"]],
    ["vrije-universiteit-brussel-vub", "Belgium", "Brussels", ["en", "zh", "nl"]],
    ["universite-libre-de-bruxelles", "Belgium", "Brussels", ["en", "zh", "fr"]],
    ["harvard-university", "United States", "Cambridge", ["en", "zh"]]
  ];
  for (const [slug, country, region, expected] of cases) assert.deepEqual(schoolTargetLocales({ slug, country, region }), expected, slug);
  assert.equal(schoolRegionalLocale({ slug: "x", country: "Atlantis" }), undefined);
});

test("country language joins the switcher only once accepted content exists", () => {
  const korea = { slug: "yonsei-university", country: "South Korea", region: "Seoul" };
  assert.deepEqual(schoolSwitcherLocales(korea, []), ["en", "zh"]);
  assert.deepEqual(schoolSwitcherLocales(korea, ["en", "ko"]), ["en", "zh", "ko"]);
  // Content in a non-target language is not offered for a base school.
  assert.deepEqual(schoolSwitcherLocales(korea, ["en", "ja"]), ["en", "zh"]);
});

test("base pages use the declared language list; full V6 pages keep all reading locales", () => {
  const path = `/universities/${baseSlug}`;
  assert.deepEqual(pageReadingLocales(path), ["en", "zh"]);
  assert.deepEqual(pageReadingLocales(path, ["en", "zh", "da"]), ["en", "zh", "da"]);
  assert.equal(readingLanguageHref(path, "da"), undefined);
  assert.equal(readingLanguageHref(path, "da", "", "", ["en", "zh", "da"]), `/da${path}`);
  assert.equal(suggestedReadingLocale(path, ["da-DK"], false, false), undefined);
  assert.equal(suggestedReadingLocale(path, ["da-DK"], false, false, ["en", "zh", "da"]), "da");
  assert.deepEqual(pageReadingLocales("/universities/harvard-university", ["en"]), READING_LOCALES);
});

test("the base-tier notice is translated for every reading locale", () => {
  const sources = JSON.parse(readFileSync("apps/web/messages/public-ui/en.json", "utf8")) as string[];
  assert.ok(sources.includes(POLICY_V6_BASE_TIER_NOTICE));
  for (const locale of READING_LOCALES.filter(locale => locale !== "en")) {
    const map = JSON.parse(readFileSync(`apps/web/messages/public-ui/${locale}.json`, "utf8")) as Record<string, string>;
    assert.ok(map[POLICY_V6_BASE_TIER_NOTICE] && map[POLICY_V6_BASE_TIER_NOTICE] !== POLICY_V6_BASE_TIER_NOTICE, locale);
  }
  const zh = JSON.parse(readFileSync("apps/web/messages/public-ui/zh.json", "utf8")) as Record<string, string>;
  assert.equal(zh[POLICY_V6_BASE_TIER_NOTICE], "本页根据公开政策记录自动整理，尚未经过逐页人工审核。");
});
