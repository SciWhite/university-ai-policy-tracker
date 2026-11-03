import assert from "node:assert/strict";
import test from "node:test";
import React, { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PolicyV6BundlePage } from "../apps/web/components/policy-v6-bundle-page";
import { PolicyV6LocalPage } from "../apps/web/components/policy-v6-local-page";
import { PolicyReferenceLayout } from "../apps/web/components/policy-reference-layout";
import { getV6PageInput } from "../apps/web/lib/policy-v6-page-input";
import { getPolicyV6Data } from "../apps/web/lib/policy-v6";

function referenceLayout(node: ReactNode): ReactElement | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement(child)) continue;
    if (child.type === PolicyReferenceLayout) return child;
    const found = referenceLayout((child.props as { children?: ReactNode }).children);
    if (found) return found;
  }
}

test("both published bundle and evidence compositions pass accepted reading labels to their sidebar", async () => {
  const previous = process.env.UAPT_V6_PUBLISHED_PAGES;
  process.env.UAPT_V6_PUBLISHED_PAGES = "1";
  try {
    const sharedUiText = { "On this page": "このページの内容", "At a glance": "概要" };
    for (const [slug, kind] of [["purdue-university", "bundle"], ["harvard-university", "evidence"]] as const) {
      const input = getV6PageInput(slug, "en");
      const data = await getPolicyV6Data("en", slug);
      const original = JSON.stringify({ data, input });
      const university = { slug, name: slug, country: "United States", region: "" };
      let page: ReactNode;
      if (kind === "bundle") {
        assert(input.bundle, `${slug} must retain its published bundle input`);
        page = PolicyV6BundlePage({ university, data, view: input.bundle, locale: "en", relatedUniversities: [], sharedUiText });
      } else {
        assert(input.evidence, `${slug} must retain its published evidence input`);
        page = PolicyV6LocalPage({ university, data, evidence: input.evidence, locale: "en", relatedUniversities: [], sharedUiText });
      }
      const layout = referenceLayout(page);
      assert(layout, `${slug} uses the shared reference composition`);
      // Render the actual composed sidebar without unrelated async history
      // children; a missing translation prop must produce a visible failure.
      const markup = renderToStaticMarkup(React.cloneElement(layout, {}, null));
      assert(markup.includes('aria-label="このページの内容"'));
      assert(markup.includes(">概要</a>"));
      assert(!markup.includes(">On this page</p>"));
      assert.equal(JSON.stringify({ data, input }), original, "UI localization must preserve original records and evidence");
    }
  } finally {
    if (previous === undefined) delete process.env.UAPT_V6_PUBLISHED_PAGES;
    else process.env.UAPT_V6_PUBLISHED_PAGES = previous;
  }
});
