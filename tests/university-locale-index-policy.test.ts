import assert from "node:assert/strict";
import test from "node:test";
import { universityIndexLocales, readingUrlIndexEligible, type UniversityLocaleIndexPolicy, type TranslationCoverage } from "../apps/web/lib/university-locale-index-policy";
import type { ReadingLocale } from "../apps/web/lib/language-catalog";

const entries: Array<[string, ReadingLocale[]]> = [["peking-university", ["en", "zh"]], ["snu", ["en", "ko"]], ["korea-university", ["en", "ko"]], ["u-tokyo", ["en", "ja"]], ["universite-de-montreal", ["en", "fr"]], ["university-of-toronto", ["en"]], ["universite-de-fribourg", ["en", "de", "fr"]], ["purdue-university", ["en", "pl"]]];
const policy: UniversityLocaleIndexPolicy = { schemaVersion: "uapt-university-locale-index-policy-v1", sourceSha256: "frozen", schools: Object.fromEntries(entries.map(([slug, locales]) => [slug, { recordSha256: slug, locales, evidence: [] }])), globalCitationExceptions: {} };
const coverage: TranslationCoverage = { sharedLocales: ["en", "zh", "ko", "ja", "fr", "de", "pl", "nl"], schools: Object.fromEntries(entries.map(([slug, locales]) => [slug, { recordSha256: slug, completeLocales: locales }])) };

test("school language decisions preserve bilingual schools and explicit cited exceptions", () => {
  for (const [slug, locales] of entries) assert.deepEqual(universityIndexLocales(slug, policy, coverage), locales);
  assert.equal(readingUrlIndexEligible("/universities/university-of-toronto", "fr", policy, coverage), false);
  assert.equal(readingUrlIndexEligible("/universities/purdue-university", "pl", policy, coverage), true);
});

test("an untranslated, stale or newly added record retains English only", () => {
  assert.deepEqual(universityIndexLocales("new-school", policy, coverage), ["en"]);
  const stale = { ...coverage, schools: { ...coverage.schools, "peking-university": { recordSha256: "old-record", completeLocales: ["zh" as const] } } };
  assert.deepEqual(universityIndexLocales("peking-university", policy, stale), ["en"]);
  assert.deepEqual(universityIndexLocales("peking-university", policy, { ...coverage, sharedLocales: ["en"] }), ["en"]);
});

test("non-priority reading variants and parameterized URLs are excluded", () => {
  assert.equal(readingUrlIndexEligible("/universities/peking-university", "nl", policy, coverage), false);
  assert.equal(readingUrlIndexEligible("/universities/peking-university?layout=reference-v4", "en", policy, coverage), false);
  assert.equal(readingUrlIndexEligible("/universities/peking-university#claims", "en", policy, coverage), false);
});
