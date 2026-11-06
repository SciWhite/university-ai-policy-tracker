import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { policyAnalysisProfileResponseSchema } from "@uapt/shared";
import { GET as comparePolicyV6 } from "../apps/web/app/api/policy-v6/compare/route";
import { GET as analysis } from "../apps/web/app/api/public/v1/analysis/universities/[slug]/route";
import { GET as university } from "../apps/web/app/api/public/v1/universities/[...slug]/route";
import { GET as latestEntityDiff } from "../apps/web/app/api/public/v1/changes/latest/[slug]/route";
import { GET as releaseEntityDiff } from "../apps/web/app/api/public/v1/changes/[releaseId]/[slug]/route";
import { GET as releaseDiff } from "../apps/web/app/api/public/v1/changes/[releaseId]/route";
import { GET as recordCorrection } from "../apps/web/app/api/public/v1/record-corrections/[revision]/route";
import { GET as v5Pages } from "../apps/web/app/api/public/v1/policy-pages/v5.json/route";
import { GET as changeEvents } from "../apps/web/app/api/public/v1/changes/events/[revision]/[slug]/route";
import { default as localizedRevisionPage } from "../apps/web/app/(default)/changes/[releaseId]/[slug]/page";
import { V6ChangeDetail } from "../apps/web/components/v6-change-detail";
import { GET as currentUniversity } from "../apps/web/app/api/public/v1/universities/[...slug]/route";
import { GET as policySnapshot } from "../apps/web/app/api/public/v1/policy-snapshots/universities/[slug]/route";
import { GET as universityStatusWidget } from "../apps/web/app/api/public/v1/widgets/university-status/[slug]/route";
import { GET as policyCoverageWidget } from "../apps/web/app/api/public/v1/widgets/policy-coverage/[slug]/route";
import { GET as reviewStateWidget } from "../apps/web/app/api/public/v1/widgets/review-state/[slug]/route";
import { GET as sourceFreshnessWidget } from "../apps/web/app/api/public/v1/widgets/source-freshness/[slug]/route";
import { GET as claims } from "../apps/web/app/api/public/v1/claims/[slug]/route";
import { getScopedRecordReleaseDiff } from "../apps/web/lib/release-diffs";
import { getCanonicalSlugForAlias } from "../apps/web/lib/entity-aliases";
import {
  readV6RecordCorrections,
  readV6RecordCorrectionRevision,
  v6BaselineRevision,
  v6RecordRevision,
  v6SummaryAtRevision
} from "../apps/web/lib/v6-effective-records";
import { publishedV6School, readPublishedV6, readPublishedV6Revision } from "../apps/web/lib/policy-v6-published";
import { loadSelectedChangeHistory } from "../apps/web/lib/change-events-api";

test("analysis API serves the V6-selected current claims and source basis for an on-demand slug", async () => {
  const slug = "aalto-university";
  const record = v6SummaryAtRevision(slug);
  assert.ok(record, "current published record must be available");

  const response = await analysis(
    new Request(`https://eduaipolicy.org/api/public/v1/analysis/universities/${slug}`),
    { params: Promise.resolve({ slug }) }
  );
  assert.equal(response.status, 200);
  const body = policyAnalysisProfileResponseSchema.parse(await response.json());
  const claimIds = new Set(record.claims.map((claim) => claim.id));
  assert.ok(body.data.basedOnClaimIds.every((id) => claimIds.has(id)));
  assert.ok(body.data.dimensions.flatMap((dimension) => dimension.evidenceSourceUrls)
    .every((url) => record.claims.some((claim) => claim.evidence.some((evidence) => evidence.sourceUrl === url))));
});

test("compare API preserves the published V6 locale, revision, and fingerprint", async () => {
  const slug = "aalto-university";
  const published = publishedV6School(slug, "fr");
  assert.ok(published, "French V6 school is published");

  const response = await comparePolicyV6(new Request(
    `https://eduaipolicy.org/api/policy-v6/compare?slugs=${slug}&locale=fr`
  ));
  assert.equal(response.status, 200);
  const body = await response.json() as { schools: Array<{ slug: string; revision: string; fingerprint: string }> };
  assert.equal(body.schools.length, 1);
  assert.equal(body.schools[0].slug, slug);
  assert.equal(body.schools[0].revision, published.revision);
  assert.equal(body.schools[0].fingerprint, published.fingerprint);
});

test("invalid compare requests retain the published handler's 400 contract", async () => {
  const response = await comparePolicyV6(new Request(
    "https://eduaipolicy.org/api/policy-v6/compare?baseline=invalid&current=invalid"
  ));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Outside published V6 comparison scope/);
});

test("on-demand retired claim aliases retain their published 308 redirect", async () => {
  const alias = "university-of-essex";
  const canonical = await getCanonicalSlugForAlias(alias);
  assert.ok(canonical, "retired identity has a published canonical slug");
  const response = await claims(
    new Request(`https://eduaipolicy.org/api/public/v1/claims/${alias}`),
    { params: Promise.resolve({ slug: alias }) }
  );
  assert.equal(response.status, 308);
  const location = new URL(response.headers.get("location")!);
  assert.equal(location.pathname, `/api/public/v1/claims/${canonical}`);
});

test("university revision API returns the pinned historical V6 record and held state", async () => {
  const slug = "aalto-university";
  const corrections = readV6RecordCorrections();
  assert.ok(corrections, "published correction package is enabled");
  const revision = v6BaselineRevision(slug, corrections);
  const expected = corrections.historical[slug]?.baseline;
  assert.ok(expected, "the selected published package retains the baseline record");

  const response = await university(
    new Request(`https://eduaipolicy.org/api/public/v1/universities/${slug}/revisions/${revision}.json`),
    { params: Promise.resolve({ slug: [slug, "revisions", `${revision}.json`] }) }
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.entity.slug, slug);
  assert.equal(body.recordRevision, revision);
  assert.equal(body.historical, true);
  assert.deepEqual(body.claims.map((claim: { id?: string }) => claim.id), expected.claims.map((claim) => claim.id));
  assert.deepEqual(body.heldClaims.map((claim: { id?: string }) => claim.id), corrections.historical[slug]!.heldClaims.map((claim) => claim.id));
});

test("current V6 university API exposes the selected revision and baseline link without caching evidence", async () => {
  const slug = "aalto-university";
  const revision = v6RecordRevision(slug);
  assert.ok(revision, "published record revision is selected");
  const response = await currentUniversity(
    new Request(`https://eduaipolicy.org/api/public/v1/universities/${slug}.json`),
    { params: Promise.resolve({ slug: [`${slug}.json`] }) }
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.recordRevision, revision);
  assert.equal(
    body.historicalRecordsUrl,
    `https://eduaipolicy.org/api/public/v1/universities/${slug}/revisions/${v6BaselineRevision(slug)}.json`
  );
  assert.equal(response.headers.get("cache-control"), "private, no-store, no-transform");
});

test("published V6 policy snapshot keeps its revision state and no-transform response", async () => {
  const slug = "aalto-university";
  assert.ok(v6RecordRevision(slug), "published record revision is selected");
  const response = await policySnapshot(
    new Request(`https://eduaipolicy.org/api/public/v1/policy-snapshots/universities/${slug}.json`),
    { params: Promise.resolve({ slug: `${slug}.json` }) }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store, no-transform");
});

test("unpublished V6 snapshot preserves the explicit not-published state and exact record revision", async () => {
  const slug = "california-institute-of-technology";
  const recordRevision = v6RecordRevision(slug);
  assert.ok(recordRevision, "published record revision exists even without a student snapshot");
  const response = await policySnapshot(
    new Request(`https://eduaipolicy.org/api/public/v1/policy-snapshots/universities/${slug}.json`),
    { params: Promise.resolve({ slug: `${slug}.json` }) }
  );
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "private, no-store, no-transform");
  const body = await response.json();
  assert.equal(body.reasonCode, "not_published");
  assert.deepEqual(body.recordRevision, recordRevision);
});

test("record correction API reads the exact historical package and selected latest pointer", async () => {
  const latest = readV6RecordCorrections();
  assert.ok(latest, "published correction package is enabled");
  for (const revision of ["latest", latest.revision]) {
    const response = await recordCorrection(
      new Request(`https://eduaipolicy.org/api/public/v1/record-corrections/${revision}.json`),
      { params: Promise.resolve({ revision: `${revision}.json` }) }
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.revision, latest.revision);
    assert.equal(body.schemaVersion, "uapt-scoped-record-diff-v1");
  }
});

test("published V5 API exposes only the V5 cohort from the selected V6 package", async () => {
  const selected = readPublishedV6();
  assert.ok(selected, "published V6 page package is enabled");
  const response = v5Pages();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.releaseId, selected.releaseId);
  assert.deepEqual(body.slugs, selected.v5Slugs ?? []);
});

test("published V6 widgets use their selected loaders and protect evidence from transforms", async () => {
  const cases = [
    { get: policyCoverageWidget, path: "policy-coverage" },
    { get: reviewStateWidget, path: "review-state" },
    { get: sourceFreshnessWidget, path: "source-freshness" },
    { get: universityStatusWidget, path: "university-status" }
  ];
  for (const item of cases) {
    const response = await item.get(
      new Request(`https://eduaipolicy.org/api/public/v1/widgets/${item.path}/ubc.json`),
      { params: Promise.resolve({ slug: "ubc.json" }) }
    );
    assert.equal(response.status, 200, `${item.path} returns a V6 payload`);
    assert.equal(response.headers.get("cache-control"), "private, no-store, no-transform");
    const body = await response.json();
    assert.equal(body.data.entitySlug, "ubc", `${item.path} retains the selected entity`);
  }
});

test("unknown and non-V6 widget slugs retain their original 404 contracts", async (t) => {
  const nonV6Slug = "university-of-macau";
  const unknownSlug = "codex-unpublished-university";
  assert.equal(v6RecordRevision(nonV6Slug), undefined, "control slug is outside the V6 record scope");
  assert.equal(v6RecordRevision(unknownSlug), undefined, "unknown slug is outside the V6 record scope");
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 404 }));

  const cases = [
    { get: policyCoverageWidget, path: "policy-coverage", error: (slug: string) => `Policy coverage widget not found: ${slug}` },
    { get: reviewStateWidget, path: "review-state", error: (slug: string) => `Review state widget not found: ${slug}` },
    { get: sourceFreshnessWidget, path: "source-freshness", error: (slug: string) => `Source freshness widget not found: ${slug}` },
    { get: universityStatusWidget, path: "university-status", error: (slug: string) => `University not found: ${slug}` }
  ];
  for (const slug of [nonV6Slug, unknownSlug]) {
    for (const item of cases) {
      const response = await item.get(
        new Request(`https://eduaipolicy.org/api/public/v1/widgets/${item.path}/${slug}.json`),
        { params: Promise.resolve({ slug: `${slug}.json` }) }
      );
      assert.equal(response.status, 404, `${item.path} preserves 404 for ${slug}`);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), { error: item.error(slug) });
    }
  }
});

test("latest entity diff preserves its published scoped correction release", async () => {
  const slug = "aalto-university";
  const corrections = readV6RecordCorrections();
  assert.ok(corrections, "published correction package is enabled");
  const revision = corrections.recordRevisions[slug];
  assert.ok(revision?.baselineRevisionId, "published record has a pinned baseline");
  const expected = await getScopedRecordReleaseDiff(revision.universityRevisionId, corrections);
  assert.ok(expected, "the published scoped release diff is available");

  const response = await latestEntityDiff(
    new Request(`https://eduaipolicy.org/api/public/v1/changes/latest/${slug}.json`),
    { params: Promise.resolve({ slug: `${slug}.json` }) }
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.currentReleaseId, revision.universityRevisionId);
  assert.equal(body.recordSha256, expected.entities.find((entity) => entity.entitySlug === slug)?.recordSha256);
  assert.deepEqual(body.scopedRecordCorrection, {
    revision: revision.universityRevisionId,
    ...corrections.changesBySlug[slug]
  });
});

test("published scoped correction release remains addressable by its revision ID", async () => {
  const slug = "aalto-university";
  const corrections = readV6RecordCorrections();
  assert.ok(corrections, "published correction package is enabled");
  const revision = corrections.recordRevisions[slug];
  assert.ok(revision?.baselineRevisionId, "published record has a pinned baseline");

  const response = await releaseEntityDiff(
    new Request(`https://eduaipolicy.org/api/public/v1/changes/${revision.universityRevisionId}/${slug}.json`),
    { params: Promise.resolve({ releaseId: revision.universityRevisionId, slug: `${slug}.json` }) }
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.currentReleaseId, revision.universityRevisionId);
  assert.equal(body.recordSha256, revision.recordSha256);
});

test("historical scoped correction release resolves from its own frozen package after the pointer advances", async () => {
  const revision = "qs25-31-v6-r1-20261020";
  const historical = readV6RecordCorrectionRevision(revision);
  assert.ok(historical, "historical correction package remains published");
  const slug = Object.entries(historical.recordRevisions).find(
    ([, recordRevision]) => recordRevision.universityRevisionId === revision
  )?.[0];
  assert.ok(slug, "historical package retains its revision owner");
  assert.notEqual(readV6RecordCorrections()?.revision, revision, "selected pointer has advanced");
  const expected = await getScopedRecordReleaseDiff(revision, historical);
  assert.ok(expected, "historical scoped release diff remains available");

  const response = await releaseEntityDiff(
    new Request(`https://eduaipolicy.org/api/public/v1/changes/${revision}/${slug}.json`),
    { params: Promise.resolve({ releaseId: revision, slug: `${slug}.json` }) }
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.currentReleaseId, revision);
  assert.equal(body.recordSha256, historical.recordRevisions[slug].recordSha256);
  assert.equal("scopedRecordCorrection" in body, false);

  const indexResponse = await releaseDiff(
    new Request(`https://eduaipolicy.org/api/public/v1/changes/${revision}.json`),
    { params: Promise.resolve({ releaseId: `${revision}.json` }) }
  );
  assert.equal(indexResponse.status, 200);

});

test("localized published V6 history pages render the exact historical revision detail", async () => {
  const cases = [
    { revision: "qs71-90-v6-reviewed-r1-20261025", slug: "university-of-cambridge", locale: "fr" },
    { revision: "qs91-100-v6-presentation-r1-20261026", slug: "national-taiwan-university", locale: "pl" }
  ];

  for (const { revision, slug, locale } of cases) {
    const published = readPublishedV6Revision(revision);
    assert.ok(published, `published historical package exists for ${revision}`);
    assert.ok([...published.slugs, ...(published.v5Slugs ?? [])].includes(slug));
    const element = await localizedRevisionPage({
      params: Promise.resolve({ releaseId: revision, slug, locale })
    }) as { type?: unknown; props?: Record<string, unknown> };
    assert.equal(element.type, V6ChangeDetail);
    assert.equal(element.props?.revision, revision);
    assert.equal(element.props?.slug, slug);
    assert.equal(element.props?.locale, locale);
  }
});

test("historical V6 page supplements are labeled as revision records, not current records", () => {
  const cases = [
    { revision: "qs71-90-v6-reviewed-r1-20261025", slug: "university-of-cambridge", locale: "fr" },
    { revision: "qs91-100-v6-presentation-r1-20261026", slug: "national-taiwan-university", locale: "pl" }
  ];
  for (const entry of cases) {
    const published = readPublishedV6Revision(entry.revision);
    assert.equal(published?.publicationKind, "v6_presentation_integration");
    const html = renderToStaticMarkup(React.createElement(V6ChangeDetail, entry));
    assert.ok(html.includes(`data-v6-release="${entry.revision}"`));
    assert.ok(published?.changeSummary?.en);
    assert.ok(html.includes(published.changeSummary.en.slice(0, 24)));
    assert.doesNotMatch(html, /current reviewed records/);
  }
});

test("existing published change event release remains readable with its frozen current-record SHA", async () => {
  const slug = "university-of-cambridge";
  const history = await loadSelectedChangeHistory(slug);
  assert.ok(history, "published event history must be available");
  const expected = history.events.find((event) => event.url === `/changes/${event.revision}/${slug}`);
  assert.ok(expected, "the selected published history retains a valid event release");
  const revision = expected.revision;

  const response = await changeEvents(
    new Request(`https://eduaipolicy.org/api/public/v1/changes/events/${history.revision}/${slug}.json?eventRevision=${revision}`),
    { params: Promise.resolve({ revision: history.revision, slug: `${slug}.json` }) }
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.revision, revision);
  assert.equal(body.id, expected.id);
  assert.equal(body.url, expected.url);
  assert.equal(history.currentRecordSha256, v6RecordRevision(slug)?.recordSha256);
});
