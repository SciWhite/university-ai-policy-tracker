import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const appRoot = path.resolve("apps/web/app/(default)");
const publicDirectories = [
  "search",
  "universities",
  "analysis",
  "changes",
  "datasets",
  "methodology",
  "citation",
  "contribute",
  "university-ai-policy-database",
  "tools",
  "sources",
  "themes",
  "regions",
  "rankings",
  "coverage",
  "source-health",
  "reports"
];
const libraryFiles = [
  path.resolve("apps/web/lib/reference-pages.ts"),
  path.resolve("apps/web/lib/policy-theme-labels.ts"),
  path.resolve("apps/web/lib/policy-analysis.ts"),
  path.resolve("apps/web/lib/reports.ts"),
  path.resolve("apps/web/lib/review-dashboards.ts"),
  path.resolve("packages/shared/src/tools.ts"),
  path.resolve("apps/web/components/tool-record-fields.tsx"),
  path.resolve("apps/web/components/claim-evidence-card.tsx"),
  path.resolve("apps/web/components/entity-sidebar.tsx"),
  path.resolve("apps/web/components/reference-tabs.tsx"),
  path.resolve("apps/web/components/analysis-status-label.tsx"),
  path.resolve("apps/web/components/source-health-label.tsx")
];
const excludedAttributeNames = new Set([
  "action",
  "className",
  "data-widget",
  "href",
  "id",
  "key",
  "method",
  "name",
  "rel",
  "target",
  "type",
  "value"
]);
const excludedPropertyNames = /(?:^|_)(?:api|canonical|chartData|href|id|key|path|releaseId|slug|url)(?:$|_)/i;
const excludedStructuredPropertyNames = new Set([
  "@context",
  "@type",
  "contentUrl",
  "dateModified",
  "datePublished",
  "encodingFormat",
  "isAccessibleForFree",
  "license",
  "position"
]);

async function main() {
  const files = [
    path.join(appRoot, "page.tsx"),
    ...(await Promise.all(publicDirectories.map((directory) => collectTsx(path.join(appRoot, directory))))).flat(),
    ...libraryFiles
  ];
  const strings = new Set<string>();

  for (const file of files) {
    const sourceText = await readFile(file, "utf8");
    const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    visit(sourceFile, strings, libraryFiles.includes(file));
  }

  [
    "{0} is listed as QS 2026 rank {1}. {2} has {3} source-backed AI policy claim record{4} from {5} official source attribution{6}. The public record preserves original-language evidence snippets, source URLs, snapshot hashes, confidence, and review state.",
    "{0} has {1} source-backed AI policy claim record{2} from {3} official source attribution{4}. The public record preserves original-language evidence snippets, source URLs, snapshot hashes, confidence, and review state.",
    "{0} This {1} status was derived from claim type, normalized value, and keyword rules over {2} supporting public claim{3}. Review the basis array before reusing this as a policy conclusion."
  ].forEach((value) => addCandidate(value, strings));

  const output = [...strings].sort((a, b) => a.localeCompare(b));
  const outputPath = path.resolve("apps/web/messages/surfaces/en.json");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`${outputPath} (${output.length} strings)`);
}

function visit(node: ts.Node, strings: Set<string>, libraryFile: boolean) {
  if (ts.isImportDeclaration(node)) return;

  if (ts.isJsxText(node)) {
    addCandidate(node.text, strings);
  } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
    const name = node.name.getText();
    if (!excludedAttributeNames.has(name)) addCandidate(node.initializer.text, strings);
  } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    if (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent)) return;
    if (ts.isJsxAttribute(node.parent)) return;
    const propertyName = getPropertyName(node.parent);
    if (
      propertyName &&
      (excludedPropertyNames.test(propertyName) ||
        excludedStructuredPropertyNames.has(propertyName))
    ) return;
    if (libraryFile || isInsideJsxExpression(node) || isReaderFacingAssignment(node.parent)) {
      addCandidate(node.text, strings);
    }
  } else if (ts.isTemplateExpression(node)) {
    const template = `${node.head.text}${node.templateSpans
      .map((span, index) => `{${index}}${span.literal.text}`)
      .join("")}`;
    const propertyName = getPropertyName(node.parent);
    if (
      (!propertyName ||
        (!excludedPropertyNames.test(propertyName) &&
          !excludedStructuredPropertyNames.has(propertyName))) &&
      (libraryFile || isInsideJsxExpression(node) || isReaderFacingAssignment(node.parent))
    ) {
      addCandidate(template, strings);
    }
  }

  ts.forEachChild(node, (child) => visit(child, strings, libraryFile));
}

function addCandidate(raw: string, strings: Set<string>) {
  const value = raw.replace(/\s+/g, " ").trim();
  if (!value || value.length < 2 || !/[A-Za-z]/.test(value)) return;
  if (value.startsWith("/") || value.startsWith("http") || value.includes("@/")) return;
  if (/[{}]/.test(value) && /^[#/{0-9}a-z_.:-]+$/i.test(value)) return;
  if (/^[a-z0-9_.:/-]+$/.test(value)) return;
  if (/^[A-Z0-9_]+$/.test(value)) return;
  if (/^(?:GET|POST|application\/|text\/|sha256:)/.test(value)) return;
  strings.add(value);
}

function getPropertyName(node: ts.Node): string | undefined {
  if (ts.isPropertyAssignment(node)) return node.name.getText().replace(/["']/g, "");
  return undefined;
}

function isInsideJsxExpression(node: ts.Node) {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isJsxExpression(current)) return true;
    if (ts.isStatement(current)) return false;
    current = current.parent;
  }
  return false;
}

function isReaderFacingAssignment(node: ts.Node) {
  if (ts.isVariableDeclaration(node)) {
    return /^(?:alt|description|heading|kicker|label|lead|notice|question|summary|text|title)$/i.test(
      node.name.getText()
    );
  }
  if (ts.isPropertyAssignment(node)) {
    return /^(?:alt|answer|description|heading|kicker|label|lead|name|notice|question|summary|text|title)$/i.test(
      node.name.getText().replace(/["']/g, "")
    );
  }
  return false;
}

async function collectTsx(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectTsx(entryPath)));
    else if (entry.isFile() && entry.name.endsWith(".tsx")) files.push(entryPath);
  }
  return files;
}

void main();
