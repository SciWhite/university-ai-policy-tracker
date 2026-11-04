import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Source-only admission: never imports pages or runs their data loaders.
const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const MAX_STATIC_ENTRIES = 256;
const onDemand = [
  "(default)/changes/[releaseId]/page.tsx",
  "api/public/v1/datasets/[artifact]/route.ts",
  "api/public/v1/datasets/release-snapshots/[releaseId]/[artifact]/route.ts",
  "sitemaps/[section]/route.ts"
];
// Public pages that read no request data in production: empty build params,
// rendered on first request and cached. They cannot force-static because the
// development-only `?layout=` preview still reads the query under next dev.
const onDemandIsr = [
  "[locale]/page.tsx",
  "(default)/universities/[slug]/page.tsx",
  "[locale]/universities/[slug]/page.tsx"
];

function source(root, relative) {
  const file = path.join(root, relative);
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
}
function unwrap(node) {
  while (node && (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node))) node = node.expression;
  return node;
}
function declaration(file, name, exportedOnly = false) {
  for (const statement of file.statements) {
    if (exportedOnly && !statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (ts.isVariableStatement(statement)) {
      const found = statement.declarationList.declarations.find(item => item.name.getText(file) === name);
      if (found) return unwrap(found.initializer);
    }
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) return statement;
  }
}
function literal(file, name) {
  const node = declaration(file, name, true);
  if (node?.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node?.kind === ts.SyntaxKind.FalseKeyword) return false;
  return node && ts.isStringLiteral(node) ? node.text : undefined;
}
function hasExport(file, name) {
  return Boolean(declaration(file, name, true)) || file.statements.some(statement =>
    ts.isExportDeclaration(statement) && (!statement.exportClause ||
      ts.isNamedExports(statement.exportClause) && statement.exportClause.elements.some(element => element.name.text === name)));
}
function property(object, name) {
  return object && ts.isObjectLiteralExpression(object)
    ? unwrap(object.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText().replace(/["']/g, "") === name)?.initializer)
    : undefined;
}
function validateRenderAttempts(root) {
  const file = source(root, "apps/web/next.config.ts");
  const experimental = property(declaration(file, "nextConfig"), "experimental");
  const attempts = property(experimental, "staticGenerationRetryCount");
  // Next 16.4.2 passes this value as maxAttempts, not additional retries.
  // Zero skips rendering entirely, including the framework error pages.
  if (!attempts || !ts.isNumericLiteral(attempts) || attempts.text !== "1" ||
      experimental.properties.some(item => ts.isSpreadAssignment(item))) {
    throw new Error("Build scope rejected: staticGenerationRetryCount must be exactly 1 (one render attempt)");
  }
}
function emptyParams(file) {
  const fn = declaration(file, "generateStaticParams", true);
  const statements = fn && ts.isFunctionDeclaration(fn) ? fn.body?.statements : undefined;
  const expression = statements?.length === 1 && ts.isReturnStatement(statements[0]) ? unwrap(statements[0].expression) : undefined;
  return expression && ts.isArrayLiteralExpression(expression) && expression.elements.length === 0;
}
const printer = ts.createPrinter({ removeComments: true });
function functionBody(file, name) {
  const fn = declaration(file, name, true);
  return fn && ts.isFunctionDeclaration(fn) && fn.body
    ? printer.printNode(ts.EmitHint.Unspecified, fn.body, file).replace(/\s+/g, "")
    : undefined;
}
function reviewedGeneratorBody(text) {
  const file = ts.createSourceFile("reviewed.ts", `export function generateStaticParams() ${text}`, ts.ScriptTarget.Latest, true);
  return functionBody(file, "generateStaticParams");
}
function collectionCount(root, relative, name) {
  const value = declaration(source(root, relative), name);
  if (value && ts.isArrayLiteralExpression(value)) return value.elements.length;
  if (value && ts.isObjectLiteralExpression(value)) return value.properties.length;
  throw new Error(`Cannot bound static parameter source ${relative}:${name}`);
}
function appFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", ".next", ".runtime-data"].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...appFiles(file));
    else files.push(file);
  }
  return files.sort();
}

export function validateWebBuildScope(root = defaultRoot) {
  validateRenderAttempts(root);
  const app = path.join(root, "apps/web/app");
  for (const relative of onDemand) {
    const file = source(root, `apps/web/app/${relative}`);
    if (!emptyParams(file) || literal(file, "dynamicParams") !== true) {
      throw new Error(`Build scope rejected: ${relative} must use empty build params and allow validated on-demand paths`);
    }
    if (literal(file, "dynamic") !== "force-static") {
      throw new Error(`Build scope rejected: ${relative} must retain first-request static caching`);
    }
  }
  for (const relative of onDemandIsr) {
    const file = source(root, `apps/web/app/${relative}`);
    if (!emptyParams(file) || literal(file, "dynamicParams") !== true) {
      throw new Error(`Build scope rejected: ${relative} must use empty build params and cache on-demand paths`);
    }
  }
  const months = collectionCount(root, "apps/web/lib/monthly-report-registry.ts", "monthlyReportRegistry");
  const macroRegions = collectionCount(root, "apps/web/lib/reports.ts", "macroRegionOrder");
  const bounded = {
    "(default)/analysis/[slug]/page.tsx": {
      count: 1 + collectionCount(root, "apps/web/lib/policy-analysis-pages.ts", "analysisThemeSpecs"),
      body: '{ const themes = await getPublishableAnalysisThemeSpecs(); return [{ slug: "policy-coverage" }, ...themes.map((theme) => ({ slug: theme.slug }))]; }'
    },
    "(default)/regions/[slug]/page.tsx": {
      count: collectionCount(root, "apps/web/lib/reference-pages.ts", "regionLandingSpecs"),
      body: "{ return regionLandingSpecs.map((spec) => ({ slug: spec.slug })); }"
    },
    "(default)/themes/[slug]/page.tsx": {
      count: collectionCount(root, "apps/web/lib/reference-pages.ts", "themeLandingSpecs"),
      body: "{ return themeLandingSpecs.map((spec) => ({ slug: spec.slug })); }"
    },
    "(default)/rankings/[slug]/page.tsx": {
      count: collectionCount(root, "apps/web/lib/reference-pages.ts", "rankingLandingSpecs"),
      body: "{ return rankingLandingSpecs.map((spec) => ({ slug: spec.slug })); }"
    },
    "(default)/reports/monthly/[month]/page.tsx": {
      count: months,
      body: "{ return monthlyReportSlugs.map((month) => ({ month })); }"
    },
    "(default)/reports/monthly/[month]/coverage/[region]/page.tsx": {
      count: months * macroRegions,
      body: `{
        const params = await Promise.all(monthlyReportSlugs.map(async (month) => {
          const report = await getMonthlyReport(month);
          return (report?.coverageGroups.map((group) => ({ month, region: getMonthlyReportCoverageSlug(group) })) ?? []);
        }));
        return params.flat();
      }`
    },
    "api/public/v1/reports/monthly/[month]/chart-data.json/route.ts": {
      count: months,
      body: "{ return monthlyReportSlugs.map((month) => ({ month })); }"
    }
  };
  const runtimeRoutes = [], staticRoutes = [], metadataRoutes = [];
  for (const fileName of appFiles(app)) {
    const relative = path.relative(app, fileName).split(path.sep).join("/");
    const name = path.basename(fileName);
    if (/^(?:favicon|icon|apple-icon|opengraph-image|twitter-image|robots|sitemap|manifest)\.(?:ico|png|jpg|jpeg|svg|webp|gif|xml|txt|webmanifest|tsx?|jsx?)$/.test(name)) {
      if (/\.[jt]sx?$/.test(name)) {
        const file = source(root, `apps/web/app/${relative}`);
        if (["generateStaticParams", "generateImageMetadata", "generateSitemaps"].some(exported => hasExport(file, exported))) {
          throw new Error(`Unreviewed metadata enumeration: ${relative}`);
        }
        if (literal(file, "runtime") === "edge" || literal(file, "dynamic") === "force-dynamic") continue;
      }
      if (relative.includes("[")) throw new Error(`Unreviewed metadata enumeration: ${relative}`);
      metadataRoutes.push({ route: relative, maxEntries: 1 });
      continue;
    }
    if (!/^(?:page\.tsx|route\.ts|layout\.tsx)$/.test(name)) continue;
    const file = source(root, `apps/web/app/${relative}`);
    if (relative === "[locale]/layout.tsx" && hasExport(file, "generateStaticParams")) {
      throw new Error(`Build scope rejected: ${relative} must allow request rendering for pages that read searchParams`);
    }
    if (relative.startsWith("[locale]/") && literal(file, "dynamicParams") === false) {
      throw new Error(`Build scope rejected: ${relative} blocks on-demand localized paths`);
    }
    const enumerates = hasExport(file, "generateStaticParams");
    // Next invokes child generators even when a parent returned []; force-dynamic
    // also does not prevent parameter collection. Review generators first.
    if (enumerates && !emptyParams(file)) {
      if (!Object.hasOwn(bounded, relative)) throw new Error(`Unreviewed static parameter enumeration: ${relative}`);
      if (functionBody(file, "generateStaticParams") !== reviewedGeneratorBody(bounded[relative].body)) {
        throw new Error(`Unreviewed static parameter enumeration: ${relative} generator changed`);
      }
      staticRoutes.push({ route: relative, maxEntries: bounded[relative].count });
      continue;
    }
    if (relative.endsWith("layout.tsx")) continue;
    if (enumerates || relative.startsWith("[locale]/") || literal(file, "dynamic") === "force-dynamic" || onDemand.includes(relative)) {
      runtimeRoutes.push(relative);
      continue;
    }
    if (!relative.includes("[")) {
      staticRoutes.push({ route: relative, maxEntries: 1 });
      continue;
    }
    runtimeRoutes.push(relative);
  }
  const maxStaticPageAndRouteEntries = staticRoutes.reduce((total, entry) => total + entry.maxEntries, 0);
  const frameworkEntryReserve = 2; // /_not-found and /_global-error
  const maxBuildPathEntries = maxStaticPageAndRouteEntries + frameworkEntryReserve + metadataRoutes.length;
  if (maxBuildPathEntries > MAX_STATIC_ENTRIES) {
    throw new Error(`Build scope rejected: ${maxBuildPathEntries} possible page/route entries exceed ${MAX_STATIC_ENTRIES} including metadata and framework reserve`);
  }
  return {
    schemaVersion: "uapt-web-build-scope-v1",
    status: "PASS",
    maxStaticPageAndRouteEntries,
    frameworkEntryReserve,
    metadataRoutes,
    maxBuildPathEntries,
    maximumAllowed: MAX_STATIC_ENTRIES,
    sourceRouteFiles: staticRoutes.length + runtimeRoutes.length,
    staticRoutes,
    runtimeRoutes,
    renderAttempts: 1,
    limits: "Conservative source bound for reviewed parameter enumerations, fixed page/route entries, static metadata and two framework entries; actual Next output, compile memory, runtime acceptance and host capacity require separate checks."
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(validateWebBuildScope())); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
