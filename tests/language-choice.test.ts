import assert from "node:assert/strict";
import test from "node:test";
import { hasContentUrl, pageReadingLocales, readingLanguageHref, suggestedReadingLocale } from "../apps/web/lib/language-choice";
import { READING_LOCALES } from "../apps/web/lib/language-catalog";
import { localizeHref } from "../apps/web/lib/i18n";
import { publishedV6Slugs } from "../apps/web/lib/policy-v6-published-gate";

// Content-language URLs (apps/web/lib/content-locales.ts, 2026-11-22): en and zh are URLs, a
// school's declared native language is a URL, every other reading locale is a UI preference
// on the English page (#ui=<locale>).

test("every localizable page offers all reading languages; only content languages are URLs", () => {
  for (const slug of publishedV6Slugs()) {
    assert.deepEqual(pageReadingLocales(`/universities/${slug}`), READING_LOCALES);
    assert.deepEqual(pageReadingLocales(`/ja/universities/${slug}`), READING_LOCALES);
  }
  assert.deepEqual(pageReadingLocales("/universities/aarhus-university"), READING_LOCALES);
  assert.equal(readingLanguageHref("/universities/aarhus-university", "ja"), "/universities/aarhus-university#ui=ja");
  assert.equal(readingLanguageHref("/universities/aarhus-university", "fr"), "/universities/aarhus-university#ui=fr");
  // A declared native language (complete accepted prose) is a URL.
  assert.equal(readingLanguageHref("/universities/universite-paris-cite", "fr", "", "", ["en", "zh", "fr"]), "/fr/universities/universite-paris-cite");
  assert.equal(hasContentUrl("/universities/universite-paris-cite", "fr", ["en", "zh", "fr"]), true);
  assert.equal(hasContentUrl("/search", "fr", ["en", "zh", "fr"]), false);
  assert.equal(readingLanguageHref("/fr/universities/aarhus-university", "zh"), "/zh/universities/aarhus-university");
  assert.deepEqual(pageReadingLocales("/internal/analytics"), ["en"]);
  assert.deepEqual(pageReadingLocales("/api/public/v1/index.json"), ["en"]);
  for (const path of ["/", "/search", "/api-reference", "/widgets", "/review/queue"]) {
    assert.deepEqual(pageReadingLocales(path), READING_LOCALES);
  }
});

test("language links keep the resource and filters; a UI preference replaces the fragment", () => {
  assert.equal(readingLanguageHref("/zh/search", "ja", "?q=AI&country=Japan", "#results"), "/search?q=AI&country=Japan#ui=ja");
  assert.equal(readingLanguageHref("/universities/harvard-university", "zh", "layout=v6", "snapshot-evidence-exams"), "/zh/universities/harvard-university?layout=v6#snapshot-evidence-exams");
  assert.equal(readingLanguageHref("/zh/search", "en", "q=AI", "results"), "/search?q=AI#results");
  // A leftover #ui= fragment is not carried to a content-language link.
  assert.equal(readingLanguageHref("/search", "zh", "", "#ui=ja"), "/zh/search");
  assert.equal(readingLanguageHref("/internal/analytics", "ja"), undefined);
  // In-page links never point at a UI-only locale URL (it would only redirect).
  assert.equal(localizeHref("/universities/aarhus-university?for=students#claims", "ja"), "/universities/aarhus-university?for=students#claims");
  assert.equal(localizeHref("/universities/harvard-university#snapshot-coursework", "ja"), "/universities/harvard-university#snapshot-coursework");
  assert.equal(localizeHref("/universities/aarhus-university", "fr"), "/universities/aarhus-university");
  assert.equal(localizeHref("/universities/aarhus-university", "zh"), "/zh/universities/aarhus-university");
});

test("first-visit suggestions respect browser order, explicit URLs and saved decisions", () => {
  assert.equal(suggestedReadingLocale("/", ["ja-JP", "en"], false, false), "ja");
  assert.equal(suggestedReadingLocale("/", ["zh-TW", "en"], false, false), "zh-Hant");
  assert.equal(suggestedReadingLocale("/", ["qaa", "ar-SA"], false, false), "ar");
  assert.equal(suggestedReadingLocale("/", ["en-CA", "zh-CN"], false, false), undefined);
  assert.equal(suggestedReadingLocale("/zh", ["ja-JP"], false, false), undefined);
  assert.equal(suggestedReadingLocale("/", ["ja-JP"], true, false), undefined);
  assert.equal(suggestedReadingLocale("/", ["ja-JP"], false, true), undefined);
  assert.equal(suggestedReadingLocale("/universities/aarhus-university", ["ja-JP"], false, false), "ja");
  assert.equal(suggestedReadingLocale("/internal/analytics", ["ja-JP"], false, false), undefined);
});
