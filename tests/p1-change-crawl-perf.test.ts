// P1 (2026-11-06): crawler load on reading-only /changes pages and release-diff cache thrash.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import robots, { readingOnlyChangePaths } from "../apps/web/app/robots";
import { READING_LOCALES } from "../apps/web/lib/language-catalog";
import { SUPPORTED_LOCALES } from "../apps/web/lib/i18n";

const root = process.cwd();

test("robots no longer blocks the old reading-locale change paths: they are cached 301s crawlers must follow", () => {
  // Since 2026-11-22 every /<uiLocale>/changes/... URL redirects to the English page
  // (apps/web/lib/content-locales.ts); a disallow would keep the old URLs in the index.
  assert.ok(readingOnlyChangePaths().includes("/ja/changes/"));
  const rules = [robots().rules].flat();
  assert.ok(rules.length >= 6);
  for (const rule of rules) {
    const disallow = [rule.disallow ?? []].flat();
    assert.deepEqual(disallow, ["/internal/analytics"], String(rule.userAgent));
  }
  assert.ok(rules.some((r) => r.userAgent === "Googlebot"));
  assert.ok(READING_LOCALES.length > SUPPORTED_LOCALES.length);
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
