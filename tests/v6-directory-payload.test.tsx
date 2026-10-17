import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getPolicyV6Data, getPolicyV6School } from "../apps/web/lib/policy-v6";
import { readPublishedV6 } from "../apps/web/lib/policy-v6-published";
import { readV6RecordCorrections } from "../apps/web/lib/v6-effective-records";
import { getPublicUniversitySummaryBySlug } from "../apps/web/lib/catalog";
import { getStaticUniversityIndexRecords } from "../apps/web/lib/university-index-records";
import { getPublicReferenceRecords, countReviewedClaims } from "../apps/web/lib/reference-pages";
import { GET as compare } from "../apps/tulsa-zone/app/api/policy-v6/compare/route";
import { GET as index } from "../apps/web/app/api/public/v1/university-index.json/route";
import QsRankingPage from "../apps/web/components/qs-ranking-page";
import type { SupportedLocale } from "../apps/web/lib/i18n";

process.env.UAPT_V6_PUBLISHED_PAGES = "1";
process.env.UAPT_DISABLE_INTERNAL_FETCH = "1";
(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("published first paint contains only the current school's complete evidence in every locale", async () => {
  const published = readPublishedV6()!;
  for (const [locale, value] of Object.entries(published.locales)) {
    for (const current of value.schools) {
      const data = await getPolicyV6Data(locale as SupportedLocale, current.slug);
      assert.equal(data.published, true);
      assert.deepEqual(data.schools, [current]);
      assert.deepEqual(data.schoolNames, Object.fromEntries(value.schools.map(s => [s.slug, s.name])));
      assert.deepEqual(await getPolicyV6School(locale as SupportedLocale, current.slug), current);
      // Other schools may contribute names, never claim bodies or source text.
      const serialized = JSON.stringify(data);
      for (const other of value.schools.filter(s => s.slug !== current.slug)) {
        for (const claim of other.topics.flatMap(t => t.claims)) {
          assert(!serialized.includes(JSON.stringify(claim.id)), `${current.slug} leaks ${claim.id}`);
        }
      }
      const before = JSON.stringify({ ...data, schools: value.schools });
      assert(serialized.length < before.length / 2, `${current.slug}: no material payload reduction`);
    }
  }
});

test("first-paint objects cannot mutate the published package used by later comparisons", async () => {
  const original = readPublishedV6()!.locales.en.schools[0];
  const frozen = JSON.stringify(original);
  const data = await getPolicyV6Data("en", original.slug);
  data.schools[0].topics.pop();
  assert.equal(JSON.stringify(await getPolicyV6School("en", original.slug)), frozen);
});

test("two-to-four-school comparisons load complete records on demand and reject invalid requests", async () => {
  const slugs = readPublishedV6()!.slugs.slice(0, 4);
  for (const locale of Object.keys(readPublishedV6()!.locales)) {
    for (const count of [2, 4]) {
      const selected = slugs.slice(0, count);
      const response = await compare(new Request(`http://localhost/api/policy-v6/compare?${new URLSearchParams({ slugs: selected.join(","), locale })}`));
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.deepEqual(payload.schools, await Promise.all(selected.map(s => getPolicyV6School(locale as SupportedLocale, s))));
    }
  }
  for (const query of ["slugs=", `slugs=${slugs[0]},${slugs[0]}`, `slugs=${slugs.join(",")},ucl`, "slugs=ucl&locale=invalid"]) {
    assert.equal((await compare(new Request(`http://localhost/api/policy-v6/compare?${query}`))).status, 400);
  }
});

test("directory rows and the full-index API agree with every effective detail record", async () => {
  const [rows, references, response] = await Promise.all([
    getStaticUniversityIndexRecords(), getPublicReferenceRecords(), index(),
  ]);
  assert.deepEqual((await response.json()).data.records, JSON.parse(JSON.stringify(rows)));
  for (const summary of readV6RecordCorrections()!.summaries) {
    const slug = summary.entity.slug;
    assert.deepEqual(await getPublicUniversitySummaryBySlug(slug), summary);
    const row = rows.find(r => r.slug === slug)!;
    const reference = references.find(r => r.slug === slug)!;
    assert.equal(row.claimCount, summary.claims.length, slug);
    assert.equal(row.sourceCount, summary.officialSources.length, slug);
    assert.equal(row.lastCheckedAt, summary.lastCheckedAt, slug);
    assert.equal(row.lastChangedAt, summary.lastChangedAt, slug);
    assert.equal(row.reviewState, summary.reviewState, slug);
    assert.deepEqual(reference.summaryRecord, summary);
    assert.equal(countReviewedClaims(reference), row.reviewedClaimCount);
  }
});

test("the bounded QS route renders current counts and dates with the existing ranking composition", async () => {
  const html = renderToStaticMarkup(await QsRankingPage());
  for (const slug of ["ucl", "cornell-university"]) {
    const summary = (await getPublicUniversitySummaryBySlug(slug))!;
    const row = html.match(new RegExp(`<tr[^>]*>(?:(?!<tr).)*href="/universities/${slug}"(?:(?!</tr>).)*</tr>`, "s"))?.[0];
    assert(row, slug);
    assert(row.includes(`${summary.claims.length} total`), slug);
    assert(row.includes(`<td>${summary.officialSources.length}</td>`), slug);
  }
});
