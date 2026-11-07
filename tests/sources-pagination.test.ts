import assert from "node:assert/strict";
import test from "node:test";
import React, { isValidElement, type ReactElement } from "react";

process.env.NEXT_PUBLIC_SITE_URL = "https://eduaipolicy.org";
process.env.NEXT_PUBLIC_MULTILINGUAL_PHASE_TWO = "1";

import SourcesPage, {
  generateMetadata as generateSourcesMetadata,
  parsePageNumber,
  getSourcesPagePath,
  sortCatalogSources,
  PAGE_SIZE
} from "../apps/web/app/(default)/sources/page";
import { generateMetadata as generateLocaleSourcesMetadata } from "../apps/web/app/[locale]/sources/page";
import { getCatalogSources, type CatalogSourceRecord } from "../apps/web/lib/catalog";

test("pagination helper functions behave correctly", () => {
  assert.equal(PAGE_SIZE, 100);

  // parsePageNumber
  assert.equal(parsePageNumber(undefined), 1);
  assert.equal(parsePageNumber(""), 1);
  assert.equal(parsePageNumber("0"), 1);
  assert.equal(parsePageNumber("-5"), 1);
  assert.equal(parsePageNumber("abc"), 1);
  assert.equal(parsePageNumber("1"), 1);
  assert.equal(parsePageNumber("2"), 2);
  assert.equal(parsePageNumber("42"), 42);
  assert.equal(parsePageNumber(["3"]), 3);
  assert.equal(parsePageNumber(5), 5);

  // getSourcesPagePath
  assert.equal(getSourcesPagePath(1), "/sources");
  assert.equal(getSourcesPagePath(0), "/sources");
  assert.equal(getSourcesPagePath(2), "/sources?page=2");
  assert.equal(getSourcesPagePath(10), "/sources?page=10");
});

test("sortCatalogSources produces stable, deterministic ordering", () => {
  const sample: CatalogSourceRecord[] = [
    {
      universitySlug: "stanford-university",
      universityName: "Stanford University",
      title: "B Policy",
      url: "https://stanford.edu/b",
      documentStatus: "official",
      serviceTreatment: "guidance",
      reviewState: "reviewed"
    },
    {
      universitySlug: "harvard-university",
      universityName: "Harvard University",
      title: "A Policy",
      url: "https://harvard.edu/a",
      documentStatus: "official",
      serviceTreatment: "guidance",
      reviewState: "reviewed"
    },
    {
      universitySlug: "stanford-university",
      universityName: "Stanford University",
      title: "A Policy",
      url: "https://stanford.edu/a",
      documentStatus: "official",
      serviceTreatment: "guidance",
      reviewState: "reviewed"
    }
  ];

  const sorted = sortCatalogSources(sample);
  assert.equal(sorted[0].universitySlug, "harvard-university");
  assert.equal(sorted[1].universitySlug, "stanford-university");
  assert.equal(sorted[1].url, "https://stanford.edu/a");
  assert.equal(sorted[2].universitySlug, "stanford-university");
  assert.equal(sorted[2].url, "https://stanford.edu/b");
});

test("generateMetadata emits correct title and canonical for default /sources", async () => {
  // Page 1 (no param)
  const meta1 = await generateSourcesMetadata({});
  assert.equal(meta1.title, "Sources | University AI Policy Tracker");
  assert.ok(String(meta1.alternates?.canonical).endsWith("/sources"));

  // Page 1 explicitly (?page=1)
  const meta1Explicit = await generateSourcesMetadata({
    searchParams: Promise.resolve({ page: "1" })
  });
  assert.equal(meta1Explicit.title, "Sources | University AI Policy Tracker");
  assert.ok(String(meta1Explicit.alternates?.canonical).endsWith("/sources"));

  // Page 2 (?page=2)
  const meta2 = await generateSourcesMetadata({
    searchParams: Promise.resolve({ page: "2" })
  });
  assert.equal(meta2.title, "Sources (Page 2) | University AI Policy Tracker");
  assert.ok(String(meta2.alternates?.canonical).endsWith("/sources?page=2"));
  assert.ok(
    String(meta2.alternates?.languages?.["zh"]).endsWith("/zh/sources?page=2")
  );
});

test("generateMetadata emits correct localized canonical for /ja/sources", async () => {
  // Page 1 in Japanese
  const jaMeta1 = await generateLocaleSourcesMetadata({
    params: Promise.resolve({ locale: "ja" }),
    searchParams: Promise.resolve({})
  });
  assert.ok(
    String(jaMeta1.alternates?.canonical).endsWith("/ja/sources"),
    `Expected /ja/sources canonical, got ${jaMeta1.alternates?.canonical}`
  );

  // Page 2 in Japanese
  const jaMeta2 = await generateLocaleSourcesMetadata({
    params: Promise.resolve({ locale: "ja" }),
    searchParams: Promise.resolve({ page: "2" })
  });
  assert.ok(
    String(jaMeta2.alternates?.canonical).endsWith("/ja/sources?page=2"),
    `Expected /ja/sources?page=2 canonical, got ${jaMeta2.alternates?.canonical}`
  );
});

test("SourcesPage renders paginated slice with rel=prev/next links", async () => {
  const allSources = await getCatalogSources();
  const totalCount = allSources.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  assert.ok(totalCount > 100, `Expected over 100 sources in catalog, found ${totalCount}`);

  // Page 1
  const page1Element = (await SourcesPage({})) as ReactElement<{
    children: unknown[];
  }>;
  assert.ok(isValidElement(page1Element));

  const page1Children = page1Element.props.children;
  // Look for rel="prev" and rel="next" in root children
  const page1Links = (Array.isArray(page1Children) ? page1Children : []).filter(
    (child): child is ReactElement<{ rel?: string; href?: string }> =>
      isValidElement(child) && child.type === "link"
  );
  const page1Prev = page1Links.find((l) => l.props.rel === "prev");
  const page1Next = page1Links.find((l) => l.props.rel === "next");

  assert.equal(page1Prev, undefined, "Page 1 should NOT have rel=prev link");
  assert.ok(page1Next, "Page 1 must have rel=next link");
  assert.equal(page1Next.props.href, "/sources?page=2");

  // Page 2
  const page2Element = (await SourcesPage({
    searchParams: Promise.resolve({ page: "2" })
  })) as ReactElement<{ children: unknown[] }>;
  const page2Children = page2Element.props.children;
  const page2Links = (Array.isArray(page2Children) ? page2Children : []).filter(
    (child): child is ReactElement<{ rel?: string; href?: string }> =>
      isValidElement(child) && child.type === "link"
  );
  const page2Prev = page2Links.find((l) => l.props.rel === "prev");
  const page2Next = page2Links.find((l) => l.props.rel === "next");

  assert.ok(page2Prev, "Page 2 must have rel=prev link");
  assert.equal(page2Prev.props.href, "/sources", "Page 2 prev link must point to /sources");
  assert.ok(page2Next, "Page 2 must have rel=next link");
  assert.equal(page2Next.props.href, "/sources?page=3");

  // Last page
  const lastPageElement = (await SourcesPage({
    searchParams: Promise.resolve({ page: String(totalPages) })
  })) as ReactElement<{ children: unknown[] }>;
  const lastPageChildren = lastPageElement.props.children;
  const lastPageLinks = (Array.isArray(lastPageChildren) ? lastPageChildren : []).filter(
    (child): child is ReactElement<{ rel?: string; href?: string }> =>
      isValidElement(child) && child.type === "link"
  );
  const lastPagePrev = lastPageLinks.find((l) => l.props.rel === "prev");
  const lastPageNext = lastPageLinks.find((l) => l.props.rel === "next");

  assert.ok(lastPagePrev, "Last page must have rel=prev link");
  assert.equal(lastPagePrev.props.href, `/sources?page=${totalPages - 1}`);
  assert.equal(lastPageNext, undefined, "Last page should NOT have rel=next link");
});
