import assert from "node:assert/strict";
import test from "node:test";
import { pageReadingLocales, readingLanguageHref, suggestedReadingLocale } from "../apps/web/lib/language-choice";
import { READING_LOCALES } from "../apps/web/lib/language-catalog";
import { localizeHref } from "../apps/web/lib/i18n";
import { publishedV6Slugs } from "../apps/web/lib/policy-v6-published-gate";

test("reading choices follow page coverage without using search index eligibility", () => {
  for (const slug of publishedV6Slugs()) {
    assert.deepEqual(pageReadingLocales(`/universities/${slug}`), READING_LOCALES);
    assert.deepEqual(pageReadingLocales(`/ja/universities/${slug}`), READING_LOCALES);
  }
  assert.deepEqual(pageReadingLocales("/universities/aarhus-university"), ["en", "zh"]);
  assert.deepEqual(pageReadingLocales("/fr/universities/aarhus-university"), ["en", "zh"]);
  assert.equal(readingLanguageHref("/universities/aarhus-university", "ja"), undefined);
  assert.equal(readingLanguageHref("/universities/aarhus-university", "fr"), undefined);
  assert.equal(readingLanguageHref("/fr/universities/aarhus-university", "zh"), "/zh/universities/aarhus-university");
  assert.deepEqual(pageReadingLocales("/internal/analytics"), ["en"]);
  assert.deepEqual(pageReadingLocales("/api/public/v1/index.json"), ["en"]);
  for (const path of ["/", "/search", "/api-reference", "/widgets", "/review/queue"]) {
    assert.deepEqual(pageReadingLocales(path), READING_LOCALES);
  }
});

test("manual language links retain the resource, filter parameters and evidence hash", () => {
  assert.equal(readingLanguageHref("/zh/search", "ja", "?q=AI&country=Japan", "#results"), "/ja/search?q=AI&country=Japan#results");
  assert.equal(readingLanguageHref("/ja/universities/harvard-university", "zh-Hant", "layout=v6", "snapshot-evidence-exams"), "/zh-Hant/universities/harvard-university?layout=v6#snapshot-evidence-exams");
  assert.equal(readingLanguageHref("/zh-Hant/search", "en", "q=AI", "results"), "/search?q=AI#results");
  assert.equal(readingLanguageHref("/internal/analytics", "ja"), undefined);
  assert.equal(localizeHref("/universities/aarhus-university?for=students#claims", "ja"), "/universities/aarhus-university?for=students#claims");
  assert.equal(localizeHref("/universities/harvard-university#snapshot-coursework", "ja"), "/ja/universities/harvard-university#snapshot-coursework");
  assert.equal(localizeHref("/universities/aarhus-university", "fr"), "/fr/universities/aarhus-university");
});

test("first-visit suggestions respect browser order, explicit URLs, page coverage and saved decisions", () => {
  assert.equal(suggestedReadingLocale("/", ["ja-JP", "en"], false, false), "ja");
  assert.equal(suggestedReadingLocale("/", ["zh-TW", "en"], false, false), "zh-Hant");
  assert.equal(suggestedReadingLocale("/", ["qaa", "ar-SA"], false, false), "ar");
  assert.equal(suggestedReadingLocale("/", ["en-CA", "zh-CN"], false, false), undefined);
  assert.equal(suggestedReadingLocale("/fr", ["ja-JP"], false, false), undefined);
  assert.equal(suggestedReadingLocale("/", ["ja-JP"], true, false), undefined);
  assert.equal(suggestedReadingLocale("/", ["ja-JP"], false, true), undefined);
  assert.equal(suggestedReadingLocale("/universities/aarhus-university", ["ja-JP"], false, false), undefined);
  assert.equal(suggestedReadingLocale("/internal/analytics", ["ja-JP"], false, false), undefined);
});
