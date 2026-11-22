import assert from "node:assert/strict";
import test from "node:test";

import { generateMetadata as generateLocaleUniversityMetadata } from "../apps/web/app/[locale]/universities/[slug]/page";
import { generateMetadata as generateDefaultUniversityMetadata } from "../apps/web/app/(default)/universities/[slug]/page";
import { READING_LOCALES } from "../apps/web/lib/language-catalog";
import { getPublicReadingUiText } from "../apps/web/lib/public-ui-translations";

// Content-language URLs (apps/web/lib/content-locales.ts, 2026-11-22): a school page in a UI-only
// locale renders only with complete accepted native prose (none in local data); otherwise it
// redirects to the English page with the locale as a UI preference. Native-name titles still
// apply to native pages (getInstitutionNativeName above; zh-Hant cases below where they render).
async function expectUiRedirect(locale: string, slug: string) {
  try {
    await generateLocaleUniversityMetadata({ params: Promise.resolve({ locale, slug }) });
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? "";
    assert.ok(digest.startsWith("NEXT_REDIRECT"), String(error));
    assert.equal(digest.split(";")[2], `/universities/${slug}#ui=${locale}`, `${locale} ${slug}`);
    return;
  }
  assert.fail(`${locale} ${slug} rendered; expected a redirect to the English page`);
}


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

test("university page title is localized for reading locales and unchanged in English (V6=0) (UI-only locales now redirect)", async () => {
  process.env.UAPT_V6_PUBLISHED_PAGES = "0";
  const enMeta = await generateDefaultUniversityMetadata({
    params: Promise.resolve({ slug: "stanford-university" }),
  });
  assert.equal(enMeta.title, "Stanford University AI policy | University AI Policy Tracker");
  const zhMeta = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "zh", slug: "stanford-university" }),
  });
  assert.equal(zhMeta.title, "斯坦福大学 AI 政策 | University AI Policy Tracker");
  await expectUiRedirect("ja", "stanford-university");
  await expectUiRedirect("de", "stanford-university");
  await expectUiRedirect("ko", "stanford-university");
});
test("university page title is localized for reading locales and unchanged in English (V6=1) (UI-only locales now redirect)", async () => {
  process.env.UAPT_V6_PUBLISHED_PAGES = "1";
  const enMeta = await generateDefaultUniversityMetadata({
    params: Promise.resolve({ slug: "stanford-university" }),
  });
  assert.equal(enMeta.title, "Stanford University AI Policy");
  const zhMeta = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "zh", slug: "stanford-university" }),
  });
  assert.equal(zhMeta.title, "斯坦福大学 AI 政策");
  await expectUiRedirect("ja", "stanford-university");
});
