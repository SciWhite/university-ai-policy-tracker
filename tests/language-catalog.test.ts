import assert from "node:assert/strict";
import test from "node:test";
import { READING_LOCALES, matchReadingLocale, preferredReadingLocale, readingDirection } from "../apps/web/lib/language-catalog";

test("all requested reading locales have distinct canonical identifiers", () => {
  assert.equal(READING_LOCALES.length, 33);
  assert.equal(new Set(READING_LOCALES).size, 33);
});

test("Chinese script and region variants preserve Traditional Chinese", () => {
  for (const tag of ["zh-Hant", "zh-hant-TW", "zh-TW", "zh_HK", "zh-MO"]) assert.equal(matchReadingLocale(tag), "zh-Hant");
  for (const tag of ["zh", "zh-Hans-CN", "zh-CN", "zh-SG"]) assert.equal(matchReadingLocale(tag), "zh");
});

test("browser preference respects English and skips genuinely unsupported languages", () => {
  assert.equal(preferredReadingLocale(["en-CA", "fr-CA"]), "en");
  assert.equal(preferredReadingLocale(["zz-ZZ", "ja-JP", "en"]), "ja");
  assert.equal(preferredReadingLocale(["nn-NO", "no-NO"]), "nb");
  assert.equal(matchReadingLocale("pt-BR"), "pt");
  assert.equal(matchReadingLocale("iw-IL"), "he");
  assert.equal(matchReadingLocale("xx"), undefined);
});

test("Arabic, Persian, Hebrew and Urdu use RTL; quotations retain their own direction", () => {
  for (const locale of ["ar", "fa", "he", "ur"] as const) assert.equal(readingDirection(locale), "rtl");
  assert.equal(readingDirection("hi"), "ltr");
  assert.equal(readingDirection("zh-Hant"), "ltr");
});
