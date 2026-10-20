import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getStagedPublicDataset } from "../apps/web/lib/staged-public-data";
import { getEntityAliasResolver } from "../apps/web/lib/entity-aliases";
import { searchEntities } from "../apps/web/lib/entity-search";
import { getStaticUniversityIndexRecords } from "../apps/web/lib/university-index-records";
import { getChangeIndexData } from "../apps/web/lib/change-records";
import {
  canonicalUniversitySlug,
  canonicalUniversitySlugs,
  universityIdentitySlugs
} from "../apps/web/lib/canonical-university-slug";
import marks from "../apps/web/lib/university-marks.json";

// 2026-10-19 directory identity audit: 13 same-QS-identity slug pairs.
const MERGES: Record<string, { canonical: string; oldName: string; systems: string[] }> = {
  "birkbeck-university-london": { canonical: "birkbeck-university-of-london", oldName: "Birkbeck University London", systems: ["arwu", "qs", "the", "usnews"] },
  "brunel-university-london": { canonical: "brunel-university-of-london", oldName: "Brunel University London", systems: ["arwu", "qs", "the", "usnews"] },
  "university-of-tuebingen": { canonical: "eberhard-karls-universitat-tubingen", oldName: "University of Tuebingen", systems: ["arwu", "qs"] },
  "university-of-essex": { canonical: "essex-university-of", oldName: "University of Essex", systems: ["arwu", "qs", "the", "usnews"] },
  "karlsruhe-institute-of-technology-kit": { canonical: "kit-karlsruhe-institute-of-technology", oldName: "Karlsruhe Institute of Technology", systems: ["arwu", "qs"] },
  "lappeenranta-lahti-university-technology-lut": { canonical: "lappeenranta-lahti-university-of-technology-lut", oldName: "Lappeenranta Lahti University Technology LUT", systems: ["qs", "usnews"] },
  "stony-brook-university": { canonical: "stony-brook-university-state-university-of-new-york", oldName: "Stony Brook University", systems: ["arwu", "qs", "the", "usnews"] },
  "university-of-sheffield": { canonical: "the-university-of-sheffield", oldName: "University of Sheffield", systems: ["arwu", "cwts", "qs", "the", "usnews"] },
  "university-of-warwick": { canonical: "the-university-of-warwick", oldName: "University of Warwick", systems: ["arwu", "cwts", "qs", "the", "usnews"] },
  "university-of-western-australia": { canonical: "the-university-of-western-australia", oldName: "University of Western Australia", systems: ["arwu", "qs", "the", "usnews"] },
  "tokyo-institute-of-technology-tokyo-tech": { canonical: "tokyo-institute-of-technology", oldName: "Tokyo Institute of Technology (Tokyo Tech)", systems: ["qs"] },
  "university-of-pavia": { canonical: "universita-degli-studi-di-pavia", oldName: "University of Pavia", systems: ["arwu", "cwts", "qs", "the", "usnews"] },
  "universitat-politecnica-catalunya": { canonical: "universitat-politecnica-de-catalunya-barcelonatech-upc", oldName: "Universitat Politecnica Catalunya", systems: ["qs"] }
};

// Claim IDs that existed only under the retired slug before the merge.
const ALIAS_CLAIM_IDS: Record<string, string[]> = {
  "brunel-university-of-london": ["cl-brunel-university-london-institutional-ai-service-815"],
  "kit-karlsruhe-institute-of-technology": [
    "cl-karlsruhe-institute-of-technology-kit-claude-372",
    "cl-karlsruhe-institute-of-technology-kit-gemini-373",
    "cl-karlsruhe-institute-of-technology-kit-institutional-ai-service-374",
    "cl-karlsruhe-institute-of-technology-kit-openai-gpt-375"
  ],
  "tokyo-institute-of-technology": ["cl-tokyo-institute-of-technology-tokyo-tech-microsoft-copilot-346"],
  "universita-degli-studi-di-pavia": [
    "cl-university-of-pavia-google-gemini-857",
    "cl-university-of-pavia-google-notebooklm-858",
    "cl-university-of-pavia-microsoft-copilot-859"
  ]
};

test("registry resolves every audited alias to its canonical slug", async () => {
  const { slugAliases } = await getEntityAliasResolver();
  for (const [alias, { canonical }] of Object.entries(MERGES)) {
    assert.equal(slugAliases.get(alias), canonical, alias);
    assert.equal(canonicalUniversitySlug(alias), canonical, alias);
    assert.deepEqual(universityIdentitySlugs(canonical).slice(0, 1), [canonical]);
  }
  assert.deepEqual(
    canonicalUniversitySlugs(["university-of-warwick", "the-university-of-warwick", "mit"]),
    ["the-university-of-warwick", "mit"]
  );
});

test("current catalog lists each merged identity once with both sides' data", async () => {
  const dataset = await getStagedPublicDataset();
  const slugs = dataset.catalogUniversities.map((university) => university.slug);
  const { slugAliases } = await getEntityAliasResolver();

  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(slugs.length, dataset.publicSummaries.length);
  assert.ok(slugs.every((slug) => !slugAliases.has(slug)), "no retired alias slug is listed");

  const claimIds = dataset.publicSummaries.flatMap((summary) =>
    summary.claims.map((claim) => `${summary.entity.slug}:${claim.id}`)
  );
  assert.equal(new Set(claimIds).size, claimIds.length, "claim IDs stay unique per record");

  for (const { canonical, oldName, systems } of Object.values(MERGES)) {
    const catalog = dataset.catalogUniversities.find((item) => item.slug === canonical);
    const summary = dataset.publicSummaries.find((item) => item.entity.slug === canonical);
    assert.ok(catalog && summary, canonical);
    assert.deepEqual([...new Set(catalog.rankings.map((ranking) => ranking.systemId))].sort(), systems, canonical);
    assert.notEqual(catalog.country, "Unknown", canonical);
    assert.notEqual(catalog.region, "Unknown", canonical);
    assert.ok(summary.claims.every((claim) => claim.entitySlug === canonical), canonical);
    if (oldName !== summary.entity.name) assert.ok(summary.entity.aliases.includes(oldName), canonical);
  }
  for (const [canonical, ids] of Object.entries(ALIAS_CLAIM_IDS)) {
    const summary = dataset.publicSummaries.find((item) => item.entity.slug === canonical);
    for (const id of ids) assert.ok(summary?.claims.some((claim) => claim.id === id), `${canonical}:${id}`);
  }
});

test("old names find the one canonical university in search and the directory index", async () => {
  const records = await getStaticUniversityIndexRecords();
  for (const [alias, { canonical, oldName }] of Object.entries(MERGES)) {
    const results = await searchEntities(oldName, { limit: 10 });
    assert.equal(results[0]?.entitySlug, canonical, oldName);
    assert.ok(results.every((result) => result.entitySlug !== alias), oldName);
    const entityMatches = results.filter((result) =>
      result.matchedFields.some((field) => field === "alias" || field === "name")
    );
    assert.ok(entityMatches.every((result) => result.entitySlug === canonical || !result.matchedFields.includes("alias")), oldName);

    const record = records.find((item) => item.slug === canonical);
    assert.ok(record, canonical);
    assert.ok(record.name === oldName || record.aliases?.includes(oldName), canonical);
  }
});

test("merged identities keep marks and replace alias change-index rows", async () => {
  for (const { canonical } of Object.values(MERGES)) {
    const local = JSON.parse(await readFile("apps/web/lib/university-marks-local.json", "utf8")) as {
      entries: Record<string, unknown>;
    };
    assert.ok(
      universityIdentitySlugs(canonical).some((slug) => slug in marks || slug in local.entries),
      `${canonical} keeps an existing mark`
    );
  }
  // Tokyo's accepted title/compact mark was filed under the retired slug.
  assert.ok(universityIdentitySlugs("tokyo-institute-of-technology").includes("tokyo-institute-of-technology-tokyo-tech"));
  assert.ok("tokyo-institute-of-technology-tokyo-tech" in marks);

  const index = await getChangeIndexData();
  const slugs = index.data.records.map((record) => record.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const [alias, { canonical }] of Object.entries(MERGES)) {
    assert.ok(!slugs.includes(alias), alias);
    const row = index.data.records.find((record) => record.slug === canonical);
    assert.ok(row, canonical);
    assert.equal(row.changeUrl, `/changes/${canonical}`);
    assert.ok(row.canonicalUrl.startsWith("https://eduaipolicy.org/universities/"), canonical);
  }
});
