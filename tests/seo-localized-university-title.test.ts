import assert from "node:assert/strict";
import test from "node:test";

import { generateMetadata as generateLocaleUniversityMetadata } from "../apps/web/app/[locale]/universities/[slug]/page";
import { generateMetadata as generateDefaultUniversityMetadata } from "../apps/web/app/(default)/universities/[slug]/page";
import { READING_LOCALES } from "../apps/web/lib/language-catalog";
import { getPublicReadingUiText } from "../apps/web/lib/public-ui-translations";

test("all 33 reading locales have 'AI policy' translated in public-ui messages", async () => {
  for (const locale of READING_LOCALES) {
    if (locale === "en") continue;
    const textMap = await getPublicReadingUiText(locale, ["AI policy", "AI Policy"]);
    const translation = textMap["AI policy"] ?? textMap["AI Policy"];
    assert.ok(
      translation && translation.length > 0,
      `Expected translation of 'AI policy' in public-ui for locale ${locale}`
    );
    assert.notEqual(
      translation,
      "AI policy",
      `Expected non-English translation for locale ${locale}, got ${translation}`
    );
  }
});

test("university page title is localized for reading locales and unchanged in English (V6=0)", async () => {
  process.env.UAPT_V6_PUBLISHED_PAGES = "0";

  // English default page
  const enMeta = await generateDefaultUniversityMetadata({
    params: Promise.resolve({ slug: "stanford-university" }),
  });
  assert.equal(enMeta.title, "Stanford University AI policy | University AI Policy Tracker");

  // Japanese page
  const jaMeta = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "ja", slug: "stanford-university" }),
  });
  assert.equal(jaMeta.title, "スタンフォード大学 AI方針 | University AI Policy Tracker");

  // Chinese page
  const zhMeta = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "zh", slug: "stanford-university" }),
  });
  assert.equal(zhMeta.title, "斯坦福大学 AI 政策 | University AI Policy Tracker");

  // German page
  const deMeta = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "de", slug: "stanford-university" }),
  });
  assert.equal(deMeta.title, "Stanford University KI-Richtlinie | University AI Policy Tracker");

  // Korean page
  const koMeta = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "ko", slug: "stanford-university" }),
  });
  assert.equal(koMeta.title, "스탠퍼드 대학교(Stanford University) AI 정책 | University AI Policy Tracker");
});

test("university page title is localized for reading locales and unchanged in English (V6=1)", async () => {
  process.env.UAPT_V6_PUBLISHED_PAGES = "1";

  // English default page
  const enMeta = await generateDefaultUniversityMetadata({
    params: Promise.resolve({ slug: "stanford-university" }),
  });
  assert.equal(enMeta.title, "Stanford University AI Policy");

  // Japanese page
  const jaMeta = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "ja", slug: "stanford-university" }),
  });
  assert.equal(jaMeta.title, "スタンフォード大学 AI方針");

  // Chinese page
  const zhMeta = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "zh", slug: "stanford-university" }),
  });
  assert.equal(zhMeta.title, "斯坦福大学 AI 政策");
});
