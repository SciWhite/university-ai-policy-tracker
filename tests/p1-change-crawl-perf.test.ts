// P1 (2026-11-06): crawler load on reading-only /changes pages and release-diff cache thrash.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import robots, { readingOnlyChangePaths } from "../apps/web/app/robots";
import { READING_LOCALES } from "../apps/web/lib/language-catalog";
import { SUPPORTED_LOCALES } from "../apps/web/lib/i18n";

const root = process.cwd();

test("robots blocks /changes only in the noindex reading-only locales, in every crawler group", () => {
  const blocked = readingOnlyChangePaths();
  assert.equal(blocked.length, READING_LOCALES.length - SUPPORTED_LOCALES.length);
  for (const locale of SUPPORTED_LOCALES) assert.ok(!blocked.includes(`/${locale}/changes/`), locale);
  for (const p of ["/de/changes/", "/ja/changes/", "/zh-Hant/changes/", "/ar/changes/"]) assert.ok(blocked.includes(p), p);
  const rules = [robots().rules].flat();
  assert.ok(rules.length >= 6);
  for (const rule of rules) {
    const disallow = [rule.disallow ?? []].flat();
    assert.ok(disallow.includes("/internal/analytics"), String(rule.userAgent));
    for (const p of blocked) assert.ok(disallow.includes(p), `${rule.userAgent} ${p}`);
  }
  assert.ok(rules.some((r) => r.userAgent === "Googlebot"));
});

test("per-school release change pages are cached like their release page", () => {
  for (const file of ["apps/web/app/(default)/changes/[releaseId]/[slug]/page.tsx", "apps/web/app/[locale]/changes/[releaseId]/[slug]/page.tsx"]) {
    const source = readFileSync(path.join(root, file), "utf8");
    assert.match(source, /export const dynamic = "force-static";/, file);
    assert.doesNotMatch(source, /force-dynamic/, file);
    assert.doesNotMatch(source, /from "next\/headers"|searchParams/, `${file} must not read request data`);
  }
});

test("the release-diff cache holds every published release diff", () => {
  const source = readFileSync(path.join(root, "apps/web/lib/release-diffs.ts"), "utf8");
  const match = source.match(/releaseDiffPromises = new BoundedAsyncCache<[^>]+>\((\d+), (\d+)\*1024\*1024/);
  assert.ok(match, "releaseDiffPromises cache definition");
  assert.ok(Number(match[1]) >= 48, "entries cover the ~40 published releases with headroom");
  assert.ok(Number(match[2]) >= 96, "bytes cover the ~52 MB of serialized diffs");
});
