import assert from "node:assert/strict";
import test from "node:test";

import { generateMetadata as generateDefaultUniversityMetadata } from "../apps/web/app/(default)/universities/[slug]/page";
import { generateMetadata as generateLocaleUniversityMetadata } from "../apps/web/app/[locale]/universities/[slug]/page";
import { getAbsoluteSiteUrl } from "../apps/web/lib/site-url";

test("hreflang alternates on university pages only list indexable locales for that school", async () => {
  // Case 1: universite-paris-cite is indexable in en, zh, fr
  const upcEn = await generateDefaultUniversityMetadata({
    params: Promise.resolve({ slug: "universite-paris-cite" }),
  });
  const upcLanguages = (upcEn.alternates as { languages: Record<string, string> }).languages;
  assert.deepEqual(
    Object.keys(upcLanguages).sort(),
    ["en", "fr", "x-default", "zh"],
    "universite-paris-cite should have exactly en, zh, fr, and x-default"
  );
  assert.equal(upcLanguages["en"], getAbsoluteSiteUrl("/universities/universite-paris-cite"));
  assert.equal(upcLanguages["fr"], getAbsoluteSiteUrl("/fr/universities/universite-paris-cite"));
  assert.equal(upcLanguages["zh"], getAbsoluteSiteUrl("/zh/universities/universite-paris-cite"));
  assert.equal(upcLanguages["x-default"], getAbsoluteSiteUrl("/universities/universite-paris-cite"));

  // Check French localized page for universite-paris-cite
  const upcFr = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "fr", slug: "universite-paris-cite" }),
  });
  const upcFrLanguages = (upcFr.alternates as { languages: Record<string, string> }).languages;
  assert.deepEqual(
    Object.keys(upcFrLanguages).sort(),
    ["en", "fr", "x-default", "zh"],
    "universite-paris-cite /fr/ page should have reciprocal hreflang for en, zh, fr, x-default"
  );

  // Case 2: stanford-university is indexable in en only
  const stanfordEn = await generateDefaultUniversityMetadata({
    params: Promise.resolve({ slug: "stanford-university" }),
  });
  const stanfordLanguages = (stanfordEn.alternates as { languages: Record<string, string> }).languages;
  assert.deepEqual(
    Object.keys(stanfordLanguages).sort(),
    ["en", "x-default"],
    "stanford-university should have only en and x-default in hreflang"
  );
  assert.equal(stanfordLanguages["en"], getAbsoluteSiteUrl("/universities/stanford-university"));
  assert.equal(stanfordLanguages["x-default"], getAbsoluteSiteUrl("/universities/stanford-university"));

  // Case 3: arizona-state-university is indexable in en, zh
  const asuEn = await generateDefaultUniversityMetadata({
    params: Promise.resolve({ slug: "arizona-state-university" }),
  });
  const asuLanguages = (asuEn.alternates as { languages: Record<string, string> }).languages;
  assert.deepEqual(
    Object.keys(asuLanguages).sort(),
    ["en", "x-default", "zh"],
    "arizona-state-university should have en, zh, and x-default"
  );
});

test("noindex university pages omit hreflang alternates (do not point to or from noindex pages)", async () => {
  // Japanese page for stanford-university is not indexable (robots: noindex, follow)
  const stanfordJa = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "ja", slug: "stanford-university" }),
  });
  const stanfordJaRobots = stanfordJa.robots as { index: boolean; follow: boolean };
  assert.equal(stanfordJaRobots.index, false, "Japanese stanford page must be noindex");
  const stanfordJaLanguages = (stanfordJa.alternates as { languages: Record<string, string> }).languages;
  assert.deepEqual(
    stanfordJaLanguages,
    {},
    "Japanese stanford page (noindex) must have empty hreflang languages"
  );

  // Polish page for universite-paris-cite is not indexable (robots: noindex, follow)
  const upcPl = await generateLocaleUniversityMetadata({
    params: Promise.resolve({ locale: "pl", slug: "universite-paris-cite" }),
  });
  const upcPlRobots = upcPl.robots as { index: boolean; follow: boolean };
  assert.equal(upcPlRobots.index, false, "Polish UPC page must be noindex");
  const upcPlLanguages = (upcPl.alternates as { languages: Record<string, string> }).languages;
  assert.deepEqual(
    upcPlLanguages,
    {},
    "Polish UPC page (noindex) must have empty hreflang languages"
  );
});
