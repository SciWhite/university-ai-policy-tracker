import assert from "node:assert/strict";
import test from "node:test";

process.env.UAPT_V6_PUBLISHED_PAGES = "1";

import ReleaseEntityChangePage from "../apps/web/app/(default)/changes/[releaseId]/[slug]/page";
import { V6ChangeDetail } from "../apps/web/components/v6-change-detail";
import { V6ChangeNote } from "../apps/web/components/v6-change-note";
import { publishedV6RevisionIds, readPublishedV6Revision } from "../apps/web/lib/policy-v6-published";
import { readV6RecordCorrectionRevision } from "../apps/web/lib/v6-effective-records";

test("/changes/[releaseId]/[slug] renders without crashing when record corrections file is absent", async () => {
  const revisions = publishedV6RevisionIds();
  assert.ok(revisions.length > 0, "Expected published V6 revisions");

  // Find a revision where readV6RecordCorrectionRevision returns undefined
  const uncorrectedRevision = revisions.find((rev) => !readV6RecordCorrectionRevision(rev));
  assert.ok(
    uncorrectedRevision,
    `Expected at least one published revision without record corrections. Available revisions: ${revisions.join(", ")}`
  );

  const v6Pkg = readPublishedV6Revision(uncorrectedRevision);
  assert.ok(v6Pkg, `Expected package for revision ${uncorrectedRevision}`);
  const slug = v6Pkg.slugs[0] ?? v6Pkg.v5Slugs?.[0];
  assert.ok(slug, `Expected a school slug for revision ${uncorrectedRevision}`);

  // Test page rendering without throwing
  const pageElement = await ReleaseEntityChangePage({
    params: Promise.resolve({
      releaseId: uncorrectedRevision,
      slug,
    }),
  });
  assert.ok(pageElement, "Expected ReleaseEntityChangePage to return a valid element without throwing");

  // Test V6ChangeDetail directly
  const detailElement = V6ChangeDetail({
    revision: uncorrectedRevision,
    slug,
    locale: "en",
  });
  assert.ok(detailElement, "Expected V6ChangeDetail to return an element");

  // Test V6ChangeNote directly
  const noteElement = V6ChangeNote({
    revision: uncorrectedRevision,
    slug,
    locale: "en",
  });
  assert.ok(noteElement, "Expected V6ChangeNote to return an element");
});
