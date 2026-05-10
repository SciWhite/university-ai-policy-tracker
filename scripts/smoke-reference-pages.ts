import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { getStagedPublicDataset } from "../apps/web/lib/staged-public-data";
import {
  rankingLandingSpecs,
  regionLandingSpecs,
  themeLandingSpecs
} from "../apps/web/lib/reference-pages";

interface SmokeFailure {
  message: string;
}

const failures: SmokeFailure[] = [];

async function main() {
  const repoRoot = process.cwd();
  const appServerRoot = path.join(repoRoot, "apps", "web", ".next", "server", "app");
  const htmlFiles = await walkFiles(appServerRoot, ".html");

  for (const spec of rankingLandingSpecs) {
    const html = await readRouteHtml(htmlFiles, `/rankings/${spec.slug}`);
    assert(
      html.includes(spec.title),
      `/rankings/${spec.slug} should prerender its title.`
    );
    assert(
      html.includes("Ranking caveats") && html.includes("Public JSON"),
      `/rankings/${spec.slug} should prerender caveats and public JSON context.`
    );
  }

  for (const spec of regionLandingSpecs) {
    const html = await readRouteHtml(htmlFiles, `/regions/${spec.slug}`);
    assert(
      html.includes(spec.title),
      `/regions/${spec.slug} should prerender its title.`
    );
    assert(
      html.includes("University records") && html.includes("official sources"),
      `/regions/${spec.slug} should prerender linked record context.`
    );
  }

  for (const spec of themeLandingSpecs) {
    const html = await readRouteHtml(htmlFiles, `/themes/${spec.slug}`);
    assert(
      html.includes(spec.title),
      `/themes/${spec.slug} should prerender its title.`
    );
    assert(
      html.includes("Matching claim records") && html.includes("Public JSON"),
      `/themes/${spec.slug} should prerender claim and JSON context.`
    );
  }

  for (const route of ["/datasets", "/citation", "/methodology"] as const) {
    const html = await readRouteHtml(htmlFiles, route);
    assert(html.length > 0, `${route} should prerender HTML.`);
    assert(
      html.includes("public") || html.includes("Public"),
      `${route} should contain trust-page content.`
    );
  }

  const dataset = await getStagedPublicDataset();
  const evidenceRecord = dataset.publicSummaries.find(
    (summary) => summary.claims.length > 0 && summary.officialSources.length > 0
  );

  assert(Boolean(evidenceRecord), "Need at least one public summary with claims and sources.");

  if (evidenceRecord) {
    const html = await readRouteHtml(
      htmlFiles,
      `/universities/${evidenceRecord.entity.slug}`
    );
    assert(
      html.includes("claim-evidence-card"),
      `/universities/${evidenceRecord.entity.slug} should server-render claim cards.`
    );
    assert(
      html.includes("evidence-block") && html.includes("source-attribution-row"),
      `/universities/${evidenceRecord.entity.slug} should server-render evidence and source rows.`
    );
    assert(
      html.includes("Suggested citation") && html.includes("Public JSON"),
      `/universities/${evidenceRecord.entity.slug} should render citation and JSON reference content.`
    );
  }

  await assertStaticPageSources(repoRoot);

  if (failures.length) {
    for (const failure of failures) console.error(`- ${failure.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Reference pages smoke passed: ${rankingLandingSpecs.length} ranking pages, ${regionLandingSpecs.length} region pages, ${themeLandingSpecs.length} theme pages, trust pages, and server-rendered university evidence verified.`
  );
}

async function assertStaticPageSources(repoRoot: string) {
  const pageFiles = [
    "apps/web/app/rankings/[slug]/page.tsx",
    "apps/web/app/regions/[slug]/page.tsx",
    "apps/web/app/themes/[slug]/page.tsx"
  ];

  for (const pageFile of pageFiles) {
    const source = await readFile(path.join(repoRoot, pageFile), "utf8");

    assert(
      source.includes('dynamic = "force-static"'),
      `${pageFile} should force static rendering.`
    );
    assert(
      source.includes("dynamicParams = false"),
      `${pageFile} should reject non-prerendered params.`
    );
    assert(
      source.includes("revalidate = false"),
      `${pageFile} should not revalidate from runtime staging data.`
    );
    assert(
      !/(staged-public-data|node:fs|readFile|readdir)/.test(source),
      `${pageFile} should not directly read staging files or filesystem at runtime.`
    );
  }
}

async function readRouteHtml(htmlFiles: string[], route: string): Promise<string> {
  const routeParts = route.split("/").filter(Boolean);
  const leaf = routeParts[routeParts.length - 1];
  const match = htmlFiles.find((file) => {
    const normalized = file.split(path.sep).join("/");

    return (
      normalized.endsWith(`${leaf}.html`) &&
      routeParts.every((part) => normalized.includes(`/${part}`))
    );
  });

  if (!match) {
    failures.push({ message: `${route} prerendered HTML was not found.` });
    return "";
  }

  return readFile(match, "utf8");
}

async function walkFiles(root: string, extension: string): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);

      if (entry.isDirectory()) return walkFiles(entryPath, extension);
      if (entry.isFile() && entry.name.endsWith(extension)) return [entryPath];

      return [];
    })
  );

  return files.flat();
}

function assert(condition: boolean, message: string): void {
  if (!condition) failures.push({ message });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
