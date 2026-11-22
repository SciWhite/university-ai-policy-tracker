import assert from "node:assert/strict";
import test from "node:test";

import { generateMetadata as generateDefaultUniversityMetadata } from "../apps/web/app/(default)/universities/[slug]/page";
import { generateMetadata as generateLocaleUniversityMetadata } from "../apps/web/app/[locale]/universities/[slug]/page";
import { getAbsoluteSiteUrl } from "../apps/web/lib/site-url";

// Content-language URLs (apps/web/lib/content-locales.ts, 2026-11-22): hreflang lists en, zh,
// x-default and a native language only where the school has complete accepted display prose.

async function redirectTarget(run: () => Promise<unknown>): Promise<string | undefined> {
  try { await run(); return undefined; } catch (error) {
    const digest = (error as { digest?: string }).digest ?? "";
    if (!digest.startsWith("NEXT_REDIRECT")) throw error;
    return digest.split(";")[2];
  }
}

test("hreflang alternates on university pages list content-language URLs only", async () => {
  // universite-paris-cite: French was indexed as a legacy UI locale with English prose; without a
  // complete accepted French reading package it is now en + zh, and /fr/ is a UI preference.
  const upcEn = await generateDefaultUniversityMetadata({ params: Promise.resolve({ slug: "universite-paris-cite" }) });
  const upcLanguages = (upcEn.alternates as { languages: Record<string, string> }).languages;
  assert.deepEqual(Object.keys(upcLanguages).sort(), ["en", "x-default", "zh"]);
  assert.equal(upcLanguages["en"], getAbsoluteSiteUrl("/universities/universite-paris-cite"));
  assert.equal(upcLanguages["zh"], getAbsoluteSiteUrl("/zh/universities/universite-paris-cite"));
  assert.equal(upcLanguages["x-default"], getAbsoluteSiteUrl("/universities/universite-paris-cite"));

  const stanfordEn = await generateDefaultUniversityMetadata({ params: Promise.resolve({ slug: "stanford-university" }) });
  assert.deepEqual(Object.keys((stanfordEn.alternates as { languages: Record<string, string> }).languages).sort(), ["en", "x-default"]);

  const asuEn = await generateDefaultUniversityMetadata({ params: Promise.resolve({ slug: "arizona-state-university" }) });
  assert.deepEqual(Object.keys((asuEn.alternates as { languages: Record<string, string> }).languages).sort(), ["en", "x-default", "zh"]);
});

test("a UI-only locale school URL without native content redirects to the English page with the UI preference", async () => {
  for (const [locale, slug] of [["ja", "stanford-university"], ["pl", "universite-paris-cite"], ["fr", "universite-paris-cite"]] as const) {
    const target = await redirectTarget(() => generateLocaleUniversityMetadata({ params: Promise.resolve({ locale, slug }) }));
    assert.equal(target, `/universities/${slug}#ui=${locale}`, `${locale} ${slug}`);
  }
  // Content locales stay pages.
  const zh = await generateLocaleUniversityMetadata({ params: Promise.resolve({ locale: "zh", slug: "arizona-state-university" }) });
  assert.equal((zh.robots as { index: boolean }).index, true);
});
