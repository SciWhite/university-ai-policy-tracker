import { readFile } from "node:fs/promises";
import path from "node:path";
import { seedUniversities } from "@uapt/shared";
import { getStagedPublicUniversityListResponse } from "../apps/web/lib/staged-public-data";
import { getStaticUniversityIndexRecords } from "../apps/web/lib/university-index-records";

interface SmokeFailure {
  message: string;
}

const failures: SmokeFailure[] = [];

async function main() {
  const repoRoot = process.cwd();
  const publicList = await getStagedPublicUniversityListResponse();
  const records = await getStaticUniversityIndexRecords();
  const publicCount = publicList.data.count;

  assert(
    records.length === publicCount,
    `/universities record count ${records.length} must match public JSON count ${publicCount}.`
  );
  assert(
    records.length > seedUniversities.length,
    `/universities is using ${records.length} records, which does not look like the ${seedUniversities.length}-record seed fallback.`
  );

  for (const systemId of ["qs", "the", "arwu", "cwts"] as const) {
    const coverage = records.filter((record) =>
      record.rankings.some((ranking) => ranking.systemId === systemId)
    ).length;
    assert(
      coverage > seedUniversities.length,
      `${systemId.toUpperCase()} ranking coverage ${coverage} should not look like seed fallback coverage.`
    );
  }

  const htmlPath = path.join(
    repoRoot,
    "apps",
    "web",
    ".next",
    "server",
    "app",
    "universities.html"
  );
  const pageHtml = await readFile(htmlPath, "utf8");
  const rowCount = (pageHtml.match(/data-university-row=""/g) ?? []).length;

  assert(
    rowCount === publicCount,
    `Static /universities HTML row count ${rowCount} must match public JSON count ${publicCount}.`
  );

  const cssPath = path.join(repoRoot, "apps", "web", "app", "globals.css");
  const css = await readFile(cssPath, "utf8");

  assert(
    /\.university-table-wrap\s*\{[\s\S]*overflow-x:\s*auto/.test(css),
    "Mobile overflow guard missing: .university-table-wrap must own horizontal table scrolling."
  );
  assert(
    /@media\s*\(max-width:\s*560px\)[\s\S]*\.university-filter-form\s*\{[\s\S]*grid-template-columns:\s*1fr/.test(
      css
    ),
    "Mobile filter form guard missing: narrow viewports must collapse filters to one column."
  );

  if (failures.length) {
    for (const failure of failures) console.error(`- ${failure.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Universities smoke passed: ${records.length} records match public JSON; ranking filters are dataset-backed; mobile overflow guards are present.`
  );
}

function assert(condition: boolean, message: string): void {
  if (!condition) failures.push({ message });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
