import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { MAX_STATIC_ENTRIES, validateWebBuildScope } from "../scripts/validate-web-build-scope.mjs";

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "uapt-build-scope-"));
  const put = (file, content) => {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  };
  const deferred = [
    "[locale]/layout.tsx", "(default)/universities/[slug]/page.tsx",
    "(default)/changes/[releaseId]/page.tsx", "api/public/v1/datasets/[artifact]/route.ts",
    "api/public/v1/datasets/release-snapshots/[releaseId]/[artifact]/route.ts", "sitemaps/[section]/route.ts"
  ];
  for (const file of deferred) put(`apps/web/app/${file}`, `
    export const dynamicParams = true;
    export const dynamic = "force-static";
    export function generateStaticParams() { return []; }
    throw new Error("scope checking must not execute application modules");
  `);
  put("apps/web/lib/monthly-report-registry.ts", 'export const monthlyReportRegistry = { "2026-05": {}, "2026-06": {} } as const;');
  put("apps/web/lib/reports.ts", 'const macroRegionOrder = ["Africa", "Asia", "Europe"] as const;');
  put("apps/web/lib/reference-pages.ts", 'export const regionLandingSpecs = [{}, {}]; export const themeLandingSpecs = [{}, {}, {}];');
  put("apps/web/lib/policy-analysis-pages.ts", 'export const analysisThemeSpecs = [{}, {}];');
  put("apps/web/app/(default)/page.tsx", 'export default function Home() { return null; }');
  return { root, put, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("scope admission checks source without running page or historical-data modules", () => {
  const f = fixture();
  try {
    const result = validateWebBuildScope(f.root);
    assert.equal(result.status, "PASS");
    assert.equal(result.maxStaticPageAndRouteEntries, 1);
    assert.ok(result.runtimeRoutes.includes("sitemaps/[section]/route.ts"));
    assert.ok(result.runtimeRoutes.includes("api/public/v1/datasets/release-snapshots/[releaseId]/[artifact]/route.ts"));
  } finally { f.cleanup(); }
});

test("restoring the locale Cartesian product is rejected before expensive data preparation", () => {
  const f = fixture();
  try {
    f.put("apps/web/app/[locale]/layout.tsx", `
      export const dynamicParams = true;
      export function generateStaticParams() { return allLocales.map(locale => ({ locale })); }
    `);
    assert.throws(() => validateWebBuildScope(f.root), /\[locale\]\/layout.tsx must use empty build params/);
  } finally { f.cleanup(); }
});

test("deferred historical downloads must retain both runtime reachability and caching", () => {
  const f = fixture();
  try {
    f.put("apps/web/app/api/public/v1/datasets/[artifact]/route.ts", `
      export const dynamicParams = false;
      export const dynamic = "force-static";
      export function generateStaticParams() { return []; }
    `);
    assert.throws(() => validateWebBuildScope(f.root), /allow validated on-demand paths/);
    f.put("apps/web/app/api/public/v1/datasets/[artifact]/route.ts", `
      export const dynamicParams = true;
      export const dynamic = "force-dynamic";
      export function generateStaticParams() { return []; }
    `);
    assert.throws(() => validateWebBuildScope(f.root), /retain first-request static caching/);
  } finally { f.cleanup(); }
});

test("unreviewed parameter expansion and excess fixed entries require explicit scope review", () => {
  const f = fixture();
  try {
    f.put("apps/web/app/(default)/archive/[revision]/page.tsx", `
      export const dynamic = "force-static";
      export function generateStaticParams() { return releases.map(revision => ({ revision })); }
    `);
    assert.throws(() => validateWebBuildScope(f.root), /Unreviewed static parameter enumeration/);
    f.put("apps/web/app/(default)/archive/[revision]/page.tsx", 'export const dynamic = "force-dynamic";');
    for (let i = 0; i < MAX_STATIC_ENTRIES; i++) {
      f.put(`apps/web/app/(default)/fixed-${i}/page.tsx`, 'export default function Page() { return null; }');
    }
    assert.throws(() => validateWebBuildScope(f.root), /possible page\/route entries exceed/);
  } finally { f.cleanup(); }
});

test("a reviewed route cannot multiply its registry without another scope review", () => {
  const f = fixture();
  try {
    f.put("apps/web/app/(default)/regions/[slug]/page.tsx", `
      export function generateStaticParams() {
        // Formatting and explanatory comments do not change the enumeration.
        return regionLandingSpecs.map((spec) => ({ slug: spec.slug }));
      }
    `);
    const before = validateWebBuildScope(f.root);
    assert.equal(before.maxStaticPageAndRouteEntries, 3);
    f.put("apps/web/app/(default)/regions/[slug]/page.tsx", `
      export function generateStaticParams() {
        return allLocales.flatMap(locale => regionLandingSpecs.map(spec => ({ locale, slug: spec.slug })));
      }
    `);
    assert.throws(() => validateWebBuildScope(f.root), /regions.*generator changed/);
  } finally { f.cleanup(); }
});

test("localized pages and nested layouts cannot block every on-demand locale", () => {
  const f = fixture();
  try {
    f.put("apps/web/app/[locale]/reports/monthly/[month]/page.tsx", `
      export const dynamic = "force-static";
      export const dynamicParams = false;
      export { generateStaticParams } from "base-report";
    `);
    assert.throws(() => validateWebBuildScope(f.root), /monthly.*blocks on-demand localized paths/);
    f.put("apps/web/app/[locale]/reports/monthly/[month]/page.tsx", 'export const dynamicParams = true;');
    f.put("apps/web/app/[locale]/reports/layout.tsx", 'export const dynamicParams = false;');
    assert.throws(() => validateWebBuildScope(f.root), /reports\/layout.tsx blocks on-demand localized paths/);
    f.put("apps/web/app/[locale]/reports/layout.tsx", 'export const dynamicParams = true;');
    assert.equal(validateWebBuildScope(f.root).status, "PASS");
  } finally { f.cleanup(); }
});
