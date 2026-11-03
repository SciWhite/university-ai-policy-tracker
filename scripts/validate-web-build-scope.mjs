import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Source-only admission: never imports pages or runs their data loaders.
const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const MAX_STATIC_ENTRIES = 256;
const onDemand = [
  "[locale]/layout.tsx",
  "(default)/universities/[slug]/page.tsx",
  "(default)/changes/[releaseId]/page.tsx",
  "api/public/v1/datasets/[artifact]/route.ts",
  "api/public/v1/datasets/release-snapshots/[releaseId]/[artifact]/route.ts",
  "sitemaps/[section]/route.ts"
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
function routeFiles(directory, includeLayouts = false) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", ".next", ".runtime-data"].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...routeFiles(file, includeLayouts));
    else if (/^(?:page\.tsx|route\.ts)$/.test(entry.name) || includeLayouts && entry.name === "layout.tsx") files.push(file);
  }
  return files.sort();
}

export function validateWebBuildScope(root = defaultRoot) {
  const app = path.join(root, "apps/web/app");
  for (const relative of onDemand) {
    const file = source(root, `apps/web/app/${relative}`);
    if (!emptyParams(file) || literal(file, "dynamicParams") !== true) {
      throw new Error(`Build scope rejected: ${relative} must use empty build params and allow validated on-demand paths`);
    }
    if (!["[locale]/layout.tsx", "(default)/universities/[slug]/page.tsx"].includes(relative) && literal(file, "dynamic") !== "force-static") {
      throw new Error(`Build scope rejected: ${relative} must retain first-request static caching`);
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
  const runtimeRoutes = [], staticRoutes = [];
  for (const fileName of routeFiles(app, true)) {
    const relative = path.relative(app, fileName).split(path.sep).join("/");
    const file = source(root, `apps/web/app/${relative}`);
    if (relative.startsWith("[locale]/") && literal(file, "dynamicParams") === false) {
      throw new Error(`Build scope rejected: ${relative} blocks on-demand localized paths beneath the empty locale build params`);
    }
    if (relative.endsWith("/layout.tsx")) continue;
    if (relative.startsWith("[locale]/") || literal(file, "dynamic") === "force-dynamic" || onDemand.includes(relative)) {
      runtimeRoutes.push(relative);
      continue;
    }
    if (!relative.includes("[")) {
      staticRoutes.push({ route: relative, maxEntries: 1 });
      continue;
    }
    if (!declaration(file, "generateStaticParams", true)) {
      runtimeRoutes.push(relative);
      continue;
    }
    if (!Object.hasOwn(bounded, relative)) throw new Error(`Unreviewed static parameter enumeration: ${relative}`);
    // A known file is not a blanket exemption: changing its enumeration needs
    // a new review even if the underlying registry still has the same size.
    if (functionBody(file, "generateStaticParams") !== reviewedGeneratorBody(bounded[relative].body)) {
      throw new Error(`Unreviewed static parameter enumeration: ${relative} generator changed`);
    }
    staticRoutes.push({ route: relative, maxEntries: bounded[relative].count });
  }
  const maxStaticPageAndRouteEntries = staticRoutes.reduce((total, entry) => total + entry.maxEntries, 0);
  if (maxStaticPageAndRouteEntries > MAX_STATIC_ENTRIES) {
    throw new Error(`Build scope rejected: ${maxStaticPageAndRouteEntries} possible page/route entries exceed ${MAX_STATIC_ENTRIES}`);
  }
  return {
    schemaVersion: "uapt-web-build-scope-v1",
    status: "PASS",
    maxStaticPageAndRouteEntries,
    maximumAllowed: MAX_STATIC_ENTRIES,
    sourceRouteFiles: staticRoutes.length + runtimeRoutes.length,
    staticRoutes,
    runtimeRoutes,
    limits: "Source estimate for reviewed page.tsx/route.ts generators only; Next metadata assets, actual output, compile memory, runtime acceptance and host capacity require separate checks."
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(validateWebBuildScope())); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
