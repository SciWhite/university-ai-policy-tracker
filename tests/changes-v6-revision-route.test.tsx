import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import HistoryPage, { generateMetadata } from "../apps/web/app/(default)/changes/[releaseId]/page";
import { getReleaseChangeRecords } from "../apps/web/lib/change-records";
import { readPublishedV6Revision } from "../apps/web/lib/policy-v6-published";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
process.env.UAPT_V6_PUBLISHED_PAGES = "1";

// R1-c folded the runtime zone's V6 release note into /changes/<releaseId>.
// IDs with release records keep the live Release Diff page; only a published
// V6/V5 revision that would otherwise 404 renders the note.
const withRecords = "qs91-100-v6-presentation-r1-20261026";
const v6Only = "qs51-70-v6-presentation-20261025";
const props = (releaseId: string, locale?: string) => ({ params: Promise.resolve({ releaseId, ...(locale ? { locale } : {}) }) });

test("fixtures: one V6 revision with release records, one without", async () => {
  assert.ok(readPublishedV6Revision(withRecords) && await getReleaseChangeRecords(withRecords));
  assert.ok(readPublishedV6Revision(v6Only) && !(await getReleaseChangeRecords(v6Only)));
});

test("a V6 revision with release records keeps the Release Diff page and metadata", async () => {
  const metadata = await generateMetadata(props(withRecords));
  assert.equal(metadata.title, `University AI Policy Tracker Release Diff: ${withRecords}`);
  assert.match(String(metadata.description), /release diff rows/);
  assert.ok(String(metadata.alternates?.canonical).endsWith(`/changes/${withRecords}`));
  assert.ok(Object.keys(metadata.alternates?.languages ?? {}).length >= 2);
  const html = renderToStaticMarkup(await HistoryPage(props(withRecords)));
  assert.doesNotMatch(html, /id="v6-page-supplement-release"/);
  assert.match(html, new RegExp(withRecords));
});

test("a V6-only revision renders the release note with full metadata", async () => {
  for (const locale of [undefined, "zh"]) {
    const metadata = await generateMetadata(props(v6Only, locale));
    assert.match(String(metadata.title), /^V6 reviewed page supplement release: /);
    assert.ok(metadata.description && metadata.description.length > 0);
    assert.ok(String(metadata.alternates?.canonical).endsWith(`/changes/${v6Only}`));
    assert.ok(Object.keys(metadata.alternates?.languages ?? {}).length >= 2);
    assert.ok(String((metadata.openGraph as { url?: string } | undefined)?.url).endsWith(`/changes/${v6Only}`));
  }
  const html = renderToStaticMarkup(await HistoryPage(props(v6Only)));
  assert.match(html, new RegExp(`data-v6-release="${v6Only}"`));
});

test("an unknown ID still 404s", async () => {
  await assert.rejects(() => HistoryPage(props("not-a-release-or-school-20990101")), /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
});
