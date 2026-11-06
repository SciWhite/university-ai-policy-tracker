import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getLocalPublicUniversitySummaryBySlug, getCatalogUniversityBySlug } from "../apps/web/lib/catalog";
import { getCanonicalSlugForAlias } from "../apps/web/lib/entity-aliases";
import { aliasSlugJsonRedirect } from "../apps/web/lib/entity-alias-redirect";

process.env.UAPT_DISABLE_INTERNAL_FETCH = "1";

const seedAliases: Record<string, string> = {
  mit: "massachusetts-institute-of-technology",
  harvard: "harvard-university",
  stanford: "stanford-university",
  oxford: "university-of-oxford"
};

test("development seed placeholders are not public universities when a catalog is published", async () => {
  for (const slug of Object.keys(seedAliases)) {
    assert.equal(await getLocalPublicUniversitySummaryBySlug(slug), undefined, slug);
    assert.equal(await getCatalogUniversityBySlug(slug), undefined, slug);
  }
  assert.ok(await getLocalPublicUniversitySummaryBySlug("massachusetts-institute-of-technology"));
  assert.ok(await getLocalPublicUniversitySummaryBySlug("university-of-toronto"));
});

test("seed short slugs redirect to the published full-name records", async () => {
  for (const [alias, canonical] of Object.entries(seedAliases)) {
    assert.equal(await getCanonicalSlugForAlias(alias), undefined, `${alias} is not a data alias`);
    const response = await aliasSlugJsonRedirect(alias, slug => `/api/public/v1/universities/${slug}.json`);
    assert.equal(response?.status, 308, alias);
    assert.ok(response?.headers.get("location")?.endsWith(`/api/public/v1/universities/${canonical}.json`), alias);
    assert.ok(await getLocalPublicUniversitySummaryBySlug(canonical), canonical);
  }
  assert.equal(await aliasSlugJsonRedirect("university-of-toronto", slug => slug), undefined);
});

test("review dashboards read the active content release, not the program directory", () => {
  const source = readFileSync(new URL("../apps/web/lib/review-dashboards.ts", import.meta.url), "utf8");
  assert.match(source, /import \{ findRepoRoot \} from "\.\/repo-root";/);
  assert.doesNotMatch(source, /async function findRepoRoot\(/);
});

test("runtime warm-up is opt-in and never runs during a program build", async () => {
  const source = readFileSync(new URL("../apps/web/lib/runtime-warmup.ts", import.meta.url), "utf8");
  assert.match(source, /UAPT_WARMUP_ON_START !== "1"/);
  assert.match(source, /UAPT_PROGRAM_BUILD === "1"/);
  assert.doesNotMatch(source, /Promise\.all|concurrency/i);
});
