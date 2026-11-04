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
    "(default)/changes/[releaseId]/page.tsx", "api/public/v1/datasets/[artifact]/route.ts",
    "api/public/v1/datasets/release-snapshots/[releaseId]/[artifact]/route.ts", "sitemaps/[section]/route.ts"
  ];
  put("apps/web/next.config.ts", 'const nextConfig = { experimental: { staticGenerationRetryCount: 1 } }; export default nextConfig;');
  put("apps/web/app/[locale]/layout.tsx", 'export default function LocaleLayout({ children }) { return children; }');
  for (const file of ["[locale]/page.tsx", "(default)/universities/[slug]/page.tsx", "[locale]/universities/[slug]/page.tsx"]) put(`apps/web/app/${file}`, `
    export const dynamicParams = true;
    export const revalidate = 3600;
    export function generateStaticParams() { return []; }
    export default function Page() { return null; }
  `);
  for (const file of deferred) put(`apps/web/app/${file}`, `
    export const dynamicParams = true;
    export const dynamic = "force-static";
    export function generateStaticParams() { return []; }
    throw new Error("scope checking must not execute application modules");
  `);
  put("apps/web/lib/monthly-report-registry.ts", 'export const monthlyReportRegistry = { "2026-05": {}, "2026-06": {} } as const;');
  put("apps/web/lib/reports.ts", 'const macroRegionOrder = ["Africa", "Asia", "Europe"] as const;');
  put("apps/web/lib/reference-pages.ts", 'export const regionLandingSpecs = [{}, {}]; export const themeLandingSpecs = [{}, {}, {}]; export const rankingLandingSpecs = [{}, {}];');
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
    assert.equal(result.maxBuildPathEntries, 3);
    assert.ok(result.runtimeRoutes.includes("sitemaps/[section]/route.ts"));
    assert.ok(result.runtimeRoutes.includes("api/public/v1/datasets/release-snapshots/[releaseId]/[artifact]/route.ts"));
  } finally { f.cleanup(); }
});

test("ordinary-render attempt count must be exactly one", () => {
  const f = fixture();
  try {
    for (const count of [0, 2, -1, 'undefined']) {
      f.put("apps/web/next.config.ts", `const nextConfig = { experimental: { staticGenerationRetryCount: ${count} } };`);
      assert.throws(() => validateWebBuildScope(f.root), /must be exactly 1/);
    }
  } finally { f.cleanup(); }
});

test("force-dynamic does not exempt an expensive parameter generator", () => {
  const f = fixture();
  try {
    f.put("apps/web/app/api/schools/[slug]/route.ts", `
      export const dynamic = "force-dynamic";
      export function generateStaticParams() { return allSchools.map(slug => ({ slug })); }
    `);
    assert.throws(() => validateWebBuildScope(f.root), /Unreviewed static parameter enumeration: api\/schools/);
    f.put("apps/web/app/api/schools/[slug]/route.ts", `
      export const dynamic = "force-dynamic";
      export function generateStaticParams() { return []; }
    `);
    assert.equal(validateWebBuildScope(f.root).status, "PASS");
  } finally { f.cleanup(); }
});

test("request-rendered locale parent cannot hide child generators or named reexports", () => {
  const f = fixture();
  try {
    for (const generator of [
      'export function generateStaticParams() { return themes.map(slug => ({ slug })); }',
      'export { generateStaticParams } from "base";',
      'export { baseGenerateStaticParams as generateStaticParams } from "base";'
    ]) {
      f.put("apps/web/app/[locale]/themes/[slug]/page.tsx", `export const dynamicParams = true; ${generator}`);
      assert.throws(() => validateWebBuildScope(f.root), /Unreviewed static parameter enumeration: \[locale\]\/themes/);
    }
  } finally { f.cleanup(); }
});

test("rankings retain and count their finite runtime allowlist", () => {
  const f = fixture();
  try {
    f.put("apps/web/app/(default)/rankings/[slug]/page.tsx", `
      export const dynamic = "force-dynamic";
      export const dynamicParams = false;
      export function generateStaticParams() { return rankingLandingSpecs.map((spec) => ({ slug: spec.slug })); }
    `);
    const result = validateWebBuildScope(f.root);
    assert.equal(result.maxStaticPageAndRouteEntries, 3);
    assert.deepEqual(result.staticRoutes.find(row => row.route.includes("rankings/")), {
      route: "(default)/rankings/[slug]/page.tsx", maxEntries: 2
    });
  } finally { f.cleanup(); }
});

test("metadata and framework entries are reserved without executing metadata modules", () => {
  const f = fixture();
  try {
    f.put("apps/web/app/icon.png", "fixture image bytes");
    f.put("apps/web/app/robots.ts", 'throw new Error("must not execute"); export default function robots() { return {}; }');
    f.put("apps/web/app/opengraph-image.tsx", 'export const runtime = "edge"; throw new Error("must not execute");');
    const result = validateWebBuildScope(f.root);
    assert.equal(result.metadataRoutes.length, 2);
    assert.equal(result.maxBuildPathEntries, 5);
    f.put("apps/web/app/opengraph-image.tsx", 'export const runtime = "edge"; export function generateImageMetadata() { return allSchools; }');
    assert.throws(() => validateWebBuildScope(f.root), /Unreviewed metadata enumeration/);
  } finally { f.cleanup(); }
});

test("the localized layout stays request rendered for query-dependent children", () => {
  const f = fixture();
  try {
    for (const params of ["[]", "allPaths.map(path => path)"]) {
      f.put("apps/web/app/[locale]/layout.tsx", `
        export const dynamicParams = true;
        export function generateStaticParams() { return ${params}; }
      `);
      assert.throws(() => validateWebBuildScope(f.root), /must allow request rendering/);
    }
  } finally { f.cleanup(); }
});

test("query-free public pages are cached on first request without build enumeration", () => {
  const f = fixture();
  try {
    for (const route of ["[locale]/page.tsx", "(default)/universities/[slug]/page.tsx", "[locale]/universities/[slug]/page.tsx"]) {
      for (const source of [
        "export const revalidate = 3600; export default function Page() { return null; }",
        "export const dynamicParams = false; export function generateStaticParams() { return []; }",
        "export const dynamicParams = true; export function generateStaticParams() { return allSchools; }"
      ]) {
        f.put(`apps/web/app/${route}`, source);
        assert.throws(() => validateWebBuildScope(f.root), /must use empty build params and cache on-demand paths/, `${route}: ${source}`);
      }
      f.put(`apps/web/app/${route}`, "export const dynamicParams = true; export function generateStaticParams() { return []; }");
    }
    assert.equal(validateWebBuildScope(f.root).status, "PASS");
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
