import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../apps/web/proxy";
import { CONTENT_LOCALES, UI_ONLY_LOCALES, uiLocaleFromFragment, uiLocaleRedirectTarget } from "../apps/web/lib/content-locales";
import { READING_LOCALES } from "../apps/web/lib/language-catalog";
import { getLocalizedAlternates } from "../apps/web/lib/i18n-metadata";
import robots from "../apps/web/app/robots";
import { getSiteBaseUrl } from "../apps/web/lib/site-url";
import { buildSitemapSection, SITEMAP_SECTION_IDS } from "../apps/web/lib/sitemap-sections";
import { changedSurface } from "../scripts/content-release/switch";
import { GET as uiText } from "../apps/web/app/ui-text/[file]/route";
import { buildUiTextDictionary, uiTextSources } from "../apps/web/lib/ui-text-dictionary";

// Owner decision 2026-11-22 ("按新结构改"): content-language URLs only (en, zh); the other 31
// reading locales are UI preferences in the browser; old URLs answer 301 (docs/render-once.md §10).

test("the reading locales split into two content languages and 31 UI-only preferences", () => {
  assert.deepEqual([...CONTENT_LOCALES], ["en", "zh"]);
  assert.equal(UI_ONLY_LOCALES.length, READING_LOCALES.length - 2);
  assert.ok(UI_ONLY_LOCALES.includes("zh-Hant") && UI_ONLY_LOCALES.includes("ms") && !UI_ONLY_LOCALES.includes("zh"));
});

test("old UI-locale URLs go to the English page with the preference in the fragment", () => {
  assert.equal(uiLocaleRedirectTarget("/fr"), "/#ui=fr");
  assert.equal(uiLocaleRedirectTarget("/fr/"), "/#ui=fr");
  assert.equal(uiLocaleRedirectTarget("/ja/changes/r1/mit", "?x=1"), "/changes/r1/mit?x=1#ui=ja");
  assert.equal(uiLocaleRedirectTarget("/zh-Hant/universities"), "/universities#ui=zh-Hant");
  assert.equal(uiLocaleRedirectTarget("/de/reports/monthly/2026-10"), "/reports/monthly/2026-10#ui=de");
  // School pages decide themselves (native page or 308 from the page).
  assert.equal(uiLocaleRedirectTarget("/ms/universities/universiti-malaya"), undefined);
  assert.equal(uiLocaleRedirectTarget("/fr//evil.example/x"), undefined, "never a protocol-relative target");
  // Content locales and unprefixed paths are not redirected.
  for (const path of ["/zh/universities", "/universities/mit", "/", "/frankfurt", "/xx/universities"]) assert.equal(uiLocaleRedirectTarget(path), undefined, path);
  assert.equal(uiLocaleFromFragment("#ui=fr"), "fr");
  assert.equal(uiLocaleFromFragment("#ui=zh-Hant"), "zh-Hant");
  assert.equal(uiLocaleFromFragment("#ui=en"), "en");
  assert.equal(uiLocaleFromFragment("#claims"), undefined);
  assert.equal(uiLocaleFromFragment("#ui=xx"), undefined);
});

test("the proxy answers a cacheable 301 to the public origin, preference in the fragment, no cookie", () => {
  for (const locale of UI_ONLY_LOCALES) {
    const response = proxy(new NextRequest(`http://127.0.0.1:3101/${locale}/changes?page=2`, { headers: { host: "eduaipolicy.org" } }));
    assert.equal(response?.status, 301, locale);
    assert.equal(response?.headers.get("location"), new URL(`/changes?page=2#ui=${locale}`, getSiteBaseUrl()).toString());
    assert.match(response?.headers.get("cache-control") ?? "", /^public, max-age=86400, s-maxage=31536000$/);
    assert.equal(response?.headers.get("set-cookie"), null);
  }
  for (const path of ["/zh/changes", "/ms/universities/universiti-malaya", "/fr/universities/universite-paris-cite"]) {
    assert.equal(proxy(new NextRequest(`http://127.0.0.1:3101${path}`))?.headers.get("x-middleware-next"), "1", path);
  }
});

test("hreflang, robots and sitemaps name content-language URLs only", async () => {
  const alternates = getLocalizedAlternates("/methodology", "en");
  assert.deepEqual(Object.keys(alternates.languages ?? {}), ["en", "zh", "x-default"]);
  for (const rule of [robots().rules].flat()) assert.deepEqual([rule.disallow ?? []].flat(), ["/internal/analytics"]);
  assert.ok(SITEMAP_SECTION_IDS.includes("zh"));
  const core = (await buildSitemapSection("core")).map(entry => new URL(entry.url).pathname);
  assert.ok(!core.some(path => /^\/(?:es|nl|ms|fr|pl)\//.test(path)), "no legacy-locale static pages in core");
  for (const locale of ["fr", "es", "ja"] as const) {
    for (const entry of await buildSitemapSection(locale)) assert.match(new URL(entry.url).pathname, new RegExp(`^/${locale}/universities/[a-z0-9-]+$`), locale);
  }
  assert.ok((await buildSitemapSection("zh")).some(entry => new URL(entry.url).pathname === "/zh/universities"));
});

test("a content switch expires and purges content-language URLs only (schools keep every locale)", () => {
  const manifest = { families: {}, files: [] } as never;
  const surface = changedSurface({ manifest, digests: { mit: "a" } }, { manifest, digests: { mit: "b" }, cohort: ["mit"] });
  assert.ok(surface.paths.includes("/ja/universities/mit"), "a school may have a native page or its redirect in any locale");
  assert.ok(surface.paths.includes("/zh/universities") && !surface.paths.includes("/ja/universities"));
  assert.ok(surface.paths.includes("/zh") && !surface.paths.includes("/fr"));
});

test("UI dictionaries are content-hashed, immutable and English-keyed", async () => {
  const manifestResponse = await uiText(new Request("http://localhost/ui-text/manifest.json"), { params: Promise.resolve({ file: "manifest.json" }) });
  const manifest = await manifestResponse.json() as { files: Record<string, string> };
  assert.deepEqual(Object.keys(manifest.files).sort(), [...UI_ONLY_LOCALES].sort());
  const file = manifest.files.fr;
  assert.match(file, /^fr\.[0-9a-f]{16}\.json$/);
  const response = await uiText(new Request(`http://localhost/ui-text/${file}`), { params: Promise.resolve({ file }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
  const body = await response.json() as { locale: string; text: Record<string, string> };
  assert.equal(body.locale, "fr");
  const sources = new Set(uiTextSources());
  assert.ok(Object.keys(body.text).length > 500);
  // Keys are English UI strings: the source lists plus the content release's accepted shared UI entries.
  assert.ok(Object.keys(body.text).filter(key => sources.has(key)).length > 500);
  const stale = await uiText(new Request("http://localhost/ui-text/fr.0000000000000000.json"), { params: Promise.resolve({ file: "fr.0000000000000000.json" }) });
  assert.equal(stale.status, 404);
  const bad = await uiText(new Request("http://localhost/ui-text/..%2Fx"), { params: Promise.resolve({ file: "../x" }) });
  assert.equal(bad.status, 404);
  // A content locale or an unknown locale is never built (cheap 404, not stored).
  for (const name of ["zh.0000000000000000.json", "xx.0000000000000000.json"]) {
    const response = await uiText(new Request(`http://localhost/ui-text/${name}`), { params: Promise.resolve({ file: name }) });
    assert.equal(response.status, 404, name);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  // A reading-only locale has a dictionary too (public-UI additions).
  assert.ok(Object.keys(await buildUiTextDictionary("ja")).length > 300);
});
