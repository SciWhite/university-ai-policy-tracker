import assert from "node:assert/strict";
import test from "node:test";

import { generateMetadata as generateLocaleUniversityMetadata } from "../apps/web/app/[locale]/universities/[slug]/page";
import { generateMetadata as generateDefaultUniversityMetadata } from "../apps/web/app/(default)/universities/[slug]/page";
import { getInstitutionNativeName } from "../apps/web/lib/institution-localization";

// Content-language URLs (apps/web/lib/content-locales.ts, 2026-11-22): a school page in a UI-only
// locale renders only with complete accepted native prose (none in local data); otherwise it
// redirects to the English page with the locale as a UI preference. Native-name titles still
// apply to native pages (getInstitutionNativeName above).
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


test("getInstitutionNativeName resolves native names correctly", () => {
  // Japanese
  assert.equal(getInstitutionNativeName("u-tokyo", "ja"), "東京大学");
  assert.equal(getInstitutionNativeName("The University of Tokyo", "ja"), "東京大学");
  assert.equal(getInstitutionNativeName("University of Tokyo", "ja"), "東京大学");

  // Korean
  assert.equal(getInstitutionNativeName("snu", "ko"), "서울대학교");
  assert.equal(getInstitutionNativeName("Seoul National University", "ko"), "서울대학교");

  // German
  assert.equal(
    getInstitutionNativeName("technical-university-of-munich", "de"),
    "Technische Universität München"
  );
  assert.equal(
    getInstitutionNativeName("Technical University of Munich", "de"),
    "Technische Universität München"
  );

  // Traditional Chinese
  assert.equal(getInstitutionNativeName("cuhk", "zh-Hant"), "香港中文大學");
  assert.equal(
    getInstitutionNativeName("The Chinese University of Hong Kong", "zh-Hant"),
    "香港中文大學"
  );

  // Cross-country: Tokyo is in Japan, so it must return undefined in German
  assert.equal(getInstitutionNativeName("u-tokyo", "de"), undefined);
  assert.equal(getInstitutionNativeName("The University of Tokyo", "de"), undefined);

  // Munich is in Germany, so it must return undefined in Japanese
  assert.equal(
    getInstitutionNativeName("technical-university-of-munich", "ja"),
    undefined
  );

  // English always returns undefined
  assert.equal(getInstitutionNativeName("u-tokyo", "en"), undefined);
});

test("Japanese university page titles use official native names (UI-only locales now redirect)", async () => {
  await expectUiRedirect("ja", "u-tokyo");
  await expectUiRedirect("ja", "kyoto-university");
});
test("Korean university page titles use official native names (UI-only locales now redirect)", async () => {
  await expectUiRedirect("ko", "snu");
  await expectUiRedirect("ko", "korea-university");
});
test("German university page titles use official native names (UI-only locales now redirect)", async () => {
  await expectUiRedirect("de", "technical-university-of-munich");
  await expectUiRedirect("de", "rwth-aachen-university");
});
test("Traditional Chinese university page titles use official native names (UI-only locales now redirect)", async () => {
  await expectUiRedirect("zh-Hant", "cuhk");
  await expectUiRedirect("zh-Hant", "national-taiwan-university");
});
test("Foreign universities stay English in other countries' reading locales (UI-only locales now redirect)", async () => {
  process.env.UAPT_V6_PUBLISHED_PAGES = "1";
  const enHarvard = await generateDefaultUniversityMetadata({
    params: Promise.resolve({ slug: "harvard-university" })
  });
  assert.equal(enHarvard.title, "Harvard University AI Policy");
  await expectUiRedirect("de", "u-tokyo");
  await expectUiRedirect("ja", "technical-university-of-munich");
});
test("Diverse reading locales use verified native names for domestic universities (UI-only locales now redirect)", async () => {
  await expectUiRedirect("it", "sapienza-university-of-rome");
  await expectUiRedirect("pt", "universidade-de-sao-paulo");
  await expectUiRedirect("nl", "delft-university-of-technology");
  await expectUiRedirect("sv", "lund-university");
  await expectUiRedirect("da", "university-of-copenhagen");
  await expectUiRedirect("fi", "university-of-helsinki");
  await expectUiRedirect("pl", "jagiellonian-university");
  await expectUiRedirect("cs", "charles-university");
  await expectUiRedirect("tr", "middle-east-technical-university");
  await expectUiRedirect("ru", "lomonosov-moscow-state-university");
  await expectUiRedirect("ar", "king-saud-university");
  await expectUiRedirect("th", "chulalongkorn-university");
  await expectUiRedirect("vi", "vietnam-national-university-hanoi");
  await expectUiRedirect("hu", "eotvos-lorand-university");
  await expectUiRedirect("lt", "vilnius-university");
});
