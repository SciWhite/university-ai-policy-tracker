import assert from "node:assert/strict";
import test from "node:test";

process.env.UAPT_V6_PUBLISHED_PAGES = "1";

import ChangeDetailPage, { generateMetadata as generateChangeDetailMetadata } from "../apps/web/app/(default)/changes/[releaseId]/page";
import ReleaseEntityChangePage, { generateMetadata as generateSchoolChangeMetadata } from "../apps/web/app/(default)/changes/[releaseId]/[slug]/page";
import { formatSchoolChangeDescription } from "../apps/web/lib/change-history-view";

function analyzeElement(node: any): { h1Count: number; jsonLdData: any[] } {
  let h1Count = 0;
  const jsonLdData: any[] = [];

  function traverse(curr: any) {
    if (!curr) return;
    if (Array.isArray(curr)) {
      for (const item of curr) traverse(item);
      return;
    }
    if (typeof curr !== "object") return;

    if (curr.type === "h1") {
      h1Count++;
    }
    if (curr.props?.data?.["@context"] === "https://schema.org") {
      jsonLdData.push(curr.props.data);
    }
    // Expand V6ChangeDetail if rendered as a JSX element
    if (curr.type?.name === "V6ChangeDetail") {
      traverse(curr.type(curr.props));
    }
    if (curr.props?.children) {
      traverse(curr.props.children);
    }
  }

  traverse(node);
  return { h1Count, jsonLdData };
}

test("formatSchoolChangeDescription generates 50-170 char description with school name and release ID", () => {
  const cases = [
    { name: "Stanford University", revision: "public-release-20260924-002", locale: "en" as const },
    { name: "Peking University", revision: "pku-v6-20261015", locale: "zh" as const },
    { name: "MIT", revision: "mit-20261010", locale: "en" as const },
    { name: "Very Long University Name That Might Exceed Standard Bounding If Not Handled Carefully In The Helper Function", revision: "v6-pages-20261013", locale: "en" as const },
  ];

  for (const c of cases) {
    const desc = formatSchoolChangeDescription(c.name, c.revision, c.locale);
    assert.ok(
      desc.length >= 50 && desc.length <= 170,
      `Expected description length between 50 and 170, got ${desc.length}: '${desc}'`
    );
    assert.ok(
      desc.includes(c.revision),
      `Expected description to include release ID ${c.revision}: '${desc}'`
    );
    // Should include school name or truncated school name
    assert.ok(
      desc.includes(c.name.slice(0, 20)),
      `Expected description to include school name ${c.name}: '${desc}'`
    );
  }
});

test("per-school change page metadata includes school name and release ID (50-170 chars)", async () => {
  const cases = [
    { releaseId: "pku-v6-20261015", slug: "peking-university", locale: "en" },
    { releaseId: "pku-v6-20261015", slug: "peking-university", locale: "zh" },
    { releaseId: "public-release-20260924-002", slug: "stanford-university", locale: "en" },
    { releaseId: "public-release-20260924-002", slug: "stanford-university", locale: "zh" },
  ];

  for (const c of cases) {
    const meta = await generateSchoolChangeMetadata({
      params: Promise.resolve({ releaseId: c.releaseId, slug: c.slug, locale: c.locale }),
    });
    assert.ok(meta.description, `Expected meta description for ${c.slug} in ${c.releaseId}`);
    assert.ok(
      meta.description.length >= 50 && meta.description.length <= 170,
      `Expected description length 50-170, got ${meta.description.length} for ${c.slug}`
    );
    assert.ok(
      meta.description.includes(c.releaseId),
      `Expected meta description to include releaseId '${c.releaseId}'`
    );
  }
});

test("/changes/[releaseId] pages have exactly one <h1> and WebPage/BreadcrumbList JSON-LD", async () => {
  const releaseIds = [
    "public-release-20260924-002", // global release diff
    "stanford-university",         // school change history
    "pku-v6-20261015",             // published V6 release note
  ];

  for (const releaseId of releaseIds) {
    const page = await ChangeDetailPage({
      params: Promise.resolve({ releaseId }),
    });
    assert.ok(page, `Expected page for /changes/${releaseId}`);

    const { h1Count, jsonLdData } = analyzeElement(page);
    assert.equal(
      h1Count,
      1,
      `Expected exactly one <h1> on /changes/${releaseId}, found ${h1Count}`
    );

    assert.ok(
      jsonLdData.length >= 1,
      `Expected JSON-LD on /changes/${releaseId}, found ${jsonLdData.length}`
    );
    const webPageLd = jsonLdData.find((d) => d["@type"] === "WebPage");
    assert.ok(webPageLd, `Expected WebPage @type in JSON-LD for /changes/${releaseId}`);
    assert.ok(
      webPageLd.breadcrumb,
      `Expected breadcrumb in WebPage JSON-LD for /changes/${releaseId}`
    );
    assert.equal(
      webPageLd.breadcrumb["@type"],
      "BreadcrumbList",
      `Expected breadcrumb to have @type BreadcrumbList on /changes/${releaseId}`
    );
    assert.ok(
      Array.isArray(webPageLd.breadcrumb.itemListElement) &&
        webPageLd.breadcrumb.itemListElement.length >= 2,
      `Expected breadcrumb items on /changes/${releaseId}`
    );
  }
});

test("/changes/[releaseId]/[slug] pages have exactly one <h1> and WebPage/BreadcrumbList JSON-LD", async () => {
  const schoolChangeCases = [
    { releaseId: "pku-v6-20261015", slug: "peking-university" },
    { releaseId: "public-release-20260924-002", slug: "stanford-university" },
  ];

  for (const { releaseId, slug } of schoolChangeCases) {
    const page = await ReleaseEntityChangePage({
      params: Promise.resolve({ releaseId, slug }),
    });
    assert.ok(page, `Expected page for /changes/${releaseId}/${slug}`);

    const { h1Count, jsonLdData } = analyzeElement(page);
    assert.equal(
      h1Count,
      1,
      `Expected exactly one <h1> on /changes/${releaseId}/${slug}, found ${h1Count}`
    );

    assert.ok(
      jsonLdData.length >= 1,
      `Expected JSON-LD on /changes/${releaseId}/${slug}, found ${jsonLdData.length}`
    );
    const webPageLd = jsonLdData.find((d) => d["@type"] === "WebPage");
    assert.ok(webPageLd, `Expected WebPage @type in JSON-LD for /changes/${releaseId}/${slug}`);
    assert.ok(
      webPageLd.breadcrumb,
      `Expected breadcrumb in WebPage JSON-LD for /changes/${releaseId}/${slug}`
    );
    assert.equal(
      webPageLd.breadcrumb["@type"],
      "BreadcrumbList",
      `Expected breadcrumb to have @type BreadcrumbList on /changes/${releaseId}/${slug}`
    );
    assert.ok(
      Array.isArray(webPageLd.breadcrumb.itemListElement) &&
        webPageLd.breadcrumb.itemListElement.length >= 3,
      `Expected breadcrumb items on /changes/${releaseId}/${slug}`
    );
  }
});
