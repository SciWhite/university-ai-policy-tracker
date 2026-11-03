import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "../apps/web/proxy";
import { READING_LOCALES } from "../apps/web/lib/language-catalog";
import { getReadingLocaleFromPathname, localizeHref, normalizeLocale, readingLocaleForLink } from "../apps/web/lib/i18n";
import { localizeSurfaceMetadata } from "../apps/web/lib/surface-localization";

test("all reading locale routes bypass private analytics auth without weakening analytics protection", () => {
  const keys = ["NODE_ENV", "NEXT_PUBLIC_MULTILINGUAL_PHASE_TWO", "INTERNAL_ANALYTICS_PASSWORD", "INGESTION_TOKEN"] as const;
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_MULTILINGUAL_PHASE_TWO = "1";
    process.env.INTERNAL_ANALYTICS_PASSWORD = "test-only-secret";
    delete process.env.INGESTION_TOKEN;
    for (const locale of READING_LOCALES) {
      const response = proxy(new NextRequest(`http://localhost/${locale}/universities/ucl`));
      assert.equal(response?.headers.get("x-middleware-next"), "1", `${locale} public route must bypass analytics authentication`);
    }
    assert.equal(proxy(new NextRequest("http://localhost/internal/analytics"))?.status, 401);
    assert.equal(proxy(new NextRequest("http://localhost/api/internal/analytics/dashboard"))?.status, 401);
    process.env.NEXT_PUBLIC_MULTILINGUAL_PHASE_TWO = "0";
    assert.equal(proxy(new NextRequest("http://localhost/ja/tools"))?.status, 404);
  } finally {
    for (const key of keys) before[key] === undefined ? delete process.env[key] : process.env[key] = before[key];
  }
});

test("navigation carries the exact reading locale and Hant uses English legacy UI fallback", () => {
  for (const locale of READING_LOCALES) {
    const selected = getReadingLocaleFromPathname(`/${locale}/universities/ucl`);
    assert.equal(localizeHref("/universities/university-of-oxford", selected), locale === "en" ? "/universities/university-of-oxford" : `/${locale}/universities/university-of-oxford`);
  }
  assert.equal(normalizeLocale("zh-Hant"), "en");
  assert.equal(normalizeLocale("zh-Hant-TW"), "en");
  assert.equal(normalizeLocale("zh"), "zh");
  assert.equal(readingLocaleForLink("/ja/universities/ucl", "en"), "ja");
  assert.equal(readingLocaleForLink("/zh-Hant/universities/ucl", "en"), "zh-Hant");
  assert.equal(readingLocaleForLink("/ja/universities/ucl", "fr"), "fr");
});

test("university metadata preserves the shared accepted index decision while ordinary new locales fail closed", () => {
  const previousPhaseTwo = process.env.NEXT_PUBLIC_MULTILINGUAL_PHASE_TWO;
  process.env.NEXT_PUBLIC_MULTILINGUAL_PHASE_TWO = "1";
  try {
  const languages = { en: "https://eduaipolicy.org/universities/ucl", fr: "https://eduaipolicy.org/fr/universities/ucl", ja: "https://eduaipolicy.org/ja/universities/ucl", "x-default": "https://eduaipolicy.org/universities/ucl" };
  const eligible = localizeSurfaceMetadata({ title: "UCL policy", alternates: { canonical: languages.ja, languages }, robots: { index: true, follow: true }, openGraph: { url: languages.ja } }, "/universities/ucl", "ja");
  assert.deepEqual(eligible.alternates?.languages, languages);
  assert.equal(eligible.alternates?.canonical, languages.ja);
  assert.deepEqual(eligible.robots, { index: true, follow: true });

  const incomplete = localizeSurfaceMetadata({ title: "Tools", alternates: { canonical: "https://eduaipolicy.org/ja/tools" }, robots: { index: true, follow: true } }, "/tools", "ja");
  assert.equal(incomplete.robots?.index, false);
  assert.equal(incomplete.robots?.follow, true);
  assert.equal(incomplete.alternates?.canonical, "http://localhost:3000/ja/tools");
  assert.equal(incomplete.alternates?.languages, undefined);
  } finally {
    if (previousPhaseTwo === undefined) delete process.env.NEXT_PUBLIC_MULTILINGUAL_PHASE_TWO;
    else process.env.NEXT_PUBLIC_MULTILINGUAL_PHASE_TWO = previousPhaseTwo;
  }
});
