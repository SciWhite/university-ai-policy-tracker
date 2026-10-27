import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { getDiscoveryPage } from "../apps/web/lib/rankings-view-data";
import { getStaticUniversityIndexRecords } from "../apps/web/lib/university-index-records";
import { getStagedPublicUniversityListResponse } from "../apps/web/lib/staged-public-data";
import {
  discoveryQueryString,
  parseDiscoveryQuery,
  safeDiscoveryReturn,
} from "../apps/web/lib/discovery-query";
const counts: Record<string, number> = {
  "qs-2026": 857,
  "qs-2027": 1504,
  "the-2026": 1000,
  "the-2027": 2297,
  "arwu-2025": 1000,
  "arwu-2026": 1000,
  "usnews-2025-2026": 1000,
  "usnews-2026-2027": 2250,
  "cwts-leiden-2025": 1000,
};
test("every edition exposes all source rows in official rank order, with no private fields", async () => {
  for (const [edition, count] of Object.entries(counts)) {
    const doc = JSON.parse(
      await readFile(`data/ranking-browser/${edition}.json`, "utf8"),
    );
    assert.equal(doc.rows.length, count);
    assert.equal(
      new Set(doc.rows.map((r: { id: string }) => r.id)).size,
      count,
    );
    for (const row of doc.rows) {
      assert.deepEqual(
        Object.keys(row).sort(),
        [
          "id",
          "name",
          "country",
          "region",
          "rankText",
          "rankNumber",
          "rowNumber",
          "sourceId",
          "sourceUrl",
        ].sort(),
      );
      assert.match(row.sourceUrl, /^https:\/\//);
    }
    const all = [];
    for (let page = 1; page <= Math.ceil(count / 100); page++) {
      const data = await getDiscoveryPage(
        "rankings",
        { edition, size: "100", page: String(page) },
        "en",
      );
      assert.equal(data.total, count);
      all.push(...data.rows);
    }
    assert.equal(all.length, count);
    assert.equal(new Set(all.map((r) => r.id)).size, count);
    assert.deepEqual(
      all.map((r) => r.rankText),
      doc.rows.map((r: { rankText: string }) => r.rankText),
    );
    for (let i = 1; i < all.length; i++)
      assert.ok(all[i].rankNumber! >= all[i - 1].rankNumber!);
    assert.equal(
      new Set(all.filter((r) => r.slug).map((r) => r.slug)).size,
      all.filter((r) => r.slug).length,
      "ambiguous multiple rows cannot silently bind to one policy identity",
    );
  }
});
test("new ranks preserve ties and bands, and never change policy metadata", async () => {
  const records = await getStaticUniversityIndexRecords(),
    bySlug = new Map(records.map((r) => [r.slug, r]));
  const qs = await getDiscoveryPage(
    "rankings",
    { edition: "qs-2027", size: "100" },
    "en",
  );
  assert.equal(qs.rows[1].rankText, "=2");
  assert.equal(qs.rows[2].rankText, "=2");
  let top100 = 0,
    top200 = 0;
  for (let page = 1; page <= 16; page++)
    for (const row of (
      await getDiscoveryPage(
        "rankings",
        { edition: "qs-2027", size: "100", page: String(page) },
        "en",
      )
    ).rows) {
      if (row.rankNumber! <= 100) top100++;
      if (row.rankNumber! <= 200) top200++;
      if (row.slug) {
        const record = bySlug.get(row.slug)!;
        assert.equal(row.lastCheckedAt, record.lastCheckedAt);
        assert.equal(row.reviewState, record.reviewState);
        assert.equal(row.claimCount, record.claimCount);
      } else {
        assert.equal(row.lastCheckedAt, undefined);
        assert.equal(row.claimCount, 0);
      }
    }
  assert.equal(top100, 102);
  assert.equal(top200, 200);
  const arwu = await getDiscoveryPage(
    "rankings",
    { edition: "arwu-2026", page: "2", size: "100" },
    "en",
  );
  assert.match(arwu.rows[0].rankText, /101[-–]150/);
  const the = await getDiscoveryPage("rankings", { edition: "the-2027" }, "en");
  assert.equal(the.unrankedCount, 849);
  const us = await getDiscoveryPage(
    "rankings",
    { edition: "usnews-2026-2027" },
    "en",
  );
  assert.equal(us.unrankedCount, 354);
});
test("directory retains every catalog identity and keeps unresolved source identities separate", async () => {
  const catalog = await getStaticUniversityIndexRecords(),
    publicList = await getStagedPublicUniversityListResponse();
  assert.equal(catalog.length, publicList.data.count);
  for (const edition of Object.keys(counts)) {
    const data = await getDiscoveryPage(
      "universities",
      { edition, scope: "policy", size: "100" },
      "en",
    );
    assert.equal(data.total, catalog.length);
  }
  const rankingOnly = await getDiscoveryPage(
    "universities",
    { scope: "ranking-only", size: "100" },
    "en",
  );
  assert.ok(rankingOnly.total > 0);
  assert.ok(
    rankingOnly.rows.every((r) => !r.slug && r.identityStatus === "pending"),
  );
});
test("pagination, filtering and sorting are bounded and edition-specific", async () => {
  const first = await getDiscoveryPage("rankings", {}, "en");
  assert.equal(first.rows.length, 25);
  assert.equal(first.query.edition, "qs-2027");
  for (const size of [10, 25, 50, 100]) {
    const last = await getDiscoveryPage(
      "rankings",
      { edition: "qs-2027", size: String(size), page: "999999" },
      "en",
    );
    assert.equal(last.query.page, Math.ceil(1504 / size));
    assert.equal(last.rows.length, 1504 % size || size);
  }
  for (const page of ["-1", "2.5", "NaN", "Infinity", "0"])
    assert.equal(
      (await getDiscoveryPage("rankings", { page }, "en")).query.page,
      1,
    );
  const filtered = await getDiscoveryPage(
    "rankings",
    { country: "Canada", page: "999", size: "10" },
    "en",
  );
  assert.ok(filtered.rows.every((r) => r.country === "Canada"));
  assert.ok(filtered.query.page <= filtered.pageCount);
  const asc = await getDiscoveryPage(
      "rankings",
      { sort: "rank", order: "asc" },
      "en",
    ),
    desc = await getDiscoveryPage(
      "rankings",
      { sort: "rank", order: "desc" },
      "en",
    );
  assert.equal(asc.rows[0].rankNumber, 1);
  assert.ok(desc.rows[0].rankNumber! > 1000);
  const directory = await getDiscoveryPage(
    "universities",
    { scope: "policy", sort: "name", size: "100" },
    "en",
  );
  assert.deepEqual(
    directory.rows.map((r) => r.name),
    directory.rows.map((r) => r.name).sort((a, b) => a.localeCompare(b, "en")),
  );
  const recent = await getDiscoveryPage(
    "universities",
    { scope: "policy", sort: "recent", size: "100" },
    "en",
  );
  assert.equal(recent.query.order, "desc");
  for (let i = 1; i < recent.rows.length; i++)
    assert.ok(
      (Date.parse(recent.rows[i - 1].lastCheckedAt ?? "") || 0) >=
        (Date.parse(recent.rows[i].lastCheckedAt ?? "") || 0),
    );
  const missing = await getDiscoveryPage(
    "universities",
    { coverage: "missing" },
    "en",
  );
  assert.ok(missing.rows.every((r) => r.rankNumber === null));
  const empty = await getDiscoveryPage(
    "rankings",
    { q: "no-university-xyz-987" },
    "en",
  );
  assert.equal(empty.total, 0);
  assert.equal(empty.query.page, 1);
});
test("URL roundtrip and return allowlist reject external and disguised destinations", () => {
  const q = parseDiscoveryQuery(
    {
      edition: "the-2027",
      country: "Canada",
      topic: ["privacy", "teaching"],
      page: "4",
      size: "50",
      sort: "recent",
      order: "desc",
    },
    "rankings",
  );
  const decoded = Object.fromEntries(
    new URLSearchParams(discoveryQueryString(q)),
  );
  assert.equal(parseDiscoveryQuery(decoded, "rankings").edition, "the-2027");
  assert.equal(decoded.page, "4");
  assert.equal(decoded.size, "50");
  for (const bad of [
    "https://evil.test",
    "//evil.test",
    "/universities/mit",
    "/rankings/unknown",
    "/rankings/../universities/mit",
    "/rankings\\evil",
    "/api/public/v1",
    "/%2f%2fevil.test",
    "/universities?x=\n",
  ])
    assert.equal(safeDiscoveryReturn(bad), null, bad);
  assert.equal(
    safeDiscoveryReturn("/zh/rankings/the-2027?page=4&size=50"),
    "/zh/rankings/the-2027?page=4&size=50",
  );
});

test("legacy links keep their historical editions and directory defaults to policy records", async () => {
  for (const [ranking, edition] of Object.entries({
    qs: "qs-2026",
    the: "the-2026",
    arwu: "arwu-2025",
    usnews: "usnews-2025-2026",
    cwts: "cwts-leiden-2025",
  })) {
    for (const mode of ["universities", "rankings"] as const)
      assert.equal(parseDiscoveryQuery({ ranking }, mode).edition, edition);
  }
  assert.equal(parseDiscoveryQuery({}, "universities").scope, "policy");
  assert.equal(parseDiscoveryQuery({}, "universities").size, 25);
  const d = await getDiscoveryPage("universities", {}, "en");
  assert.equal(d.total, (await getStaticUniversityIndexRecords()).length);
  assert.ok(d.rows.every((r) => r.claimCount > 0));
  assert.equal(
    discoveryQueryString(
      parseDiscoveryQuery({}, "universities"),
      "universities",
    ),
    "",
  );
  assert.equal(
    discoveryQueryString(parseDiscoveryQuery({}, "rankings"), "rankings"),
    "",
  );
  assert.equal(
    discoveryQueryString(
      parseDiscoveryQuery({ edition: "the-2027" }, "rankings"),
      "rankings",
      "the-2027",
    ),
    "",
  );
});
test("country aliases filter the same rows; seven reviewed identity variants link without changing policy metadata", async () => {
  for (const [a, b] of [
    ["China", "China (Mainland)"],
    ["Macau SAR", "Macao SAR China"],
    ["Turkey", "Türkiye"],
    ["Czech Republic", "Czechia"],
  ]) {
    const left = await getDiscoveryPage(
        "universities",
        { country: a, scope: "all", size: "100" },
        "en",
      ),
      right = await getDiscoveryPage(
        "universities",
        { country: b, scope: "all", size: "100" },
        "en",
      );
    assert.deepEqual(
      left.rows.map((r) => r.id),
      right.rows.map((r) => r.id),
    );
    assert.equal(left.total, right.total);
  }
  const expected: Record<string, string> = {
    "587": "university-of-technology-sydney",
    "387": "universiti-teknologi-malaysia",
    "14378": "university-of-macau",
    "439": "national-sun-yat-sen-university",
    "50507": "chandigarh-university",
    "210": "florida-international-university",
    "2293": "university-of-texas-at-san-antonio",
  };
  const found = new Set<string>(),
    catalog = new Map(
      (await getStaticUniversityIndexRecords()).map((r) => [r.slug, r]),
    );
  for (let page = 1; page <= 16; page++)
    for (const row of (
      await getDiscoveryPage(
        "rankings",
        { size: "100", page: String(page) },
        "en",
      )
    ).rows) {
      if (!expected[row.sourceId]) continue;
      assert.equal(row.slug, expected[row.sourceId]);
      assert.equal(row.lastCheckedAt, catalog.get(row.slug)?.lastCheckedAt);
      found.add(row.sourceId);
    }
  assert.equal(found.size, 7);
  const all = await getDiscoveryPage("universities", { scope: "all" }, "en");
  assert.ok(!all.countries.includes("China (Mainland)"));
  assert.ok(!all.countries.includes("Macao SAR China"));
});
