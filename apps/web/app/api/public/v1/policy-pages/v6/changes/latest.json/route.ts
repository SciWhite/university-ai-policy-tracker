import { NextResponse } from "next/server";
import { readV6RecordCorrections, v6SummaryAtRevision } from "@/lib/v6-effective-records";
import { readPublishedV6, publishedV6School } from "@/lib/policy-v6-published";

export const dynamic = "force-dynamic";

export function GET() {
  const data = readPublishedV6();
  const correction = readV6RecordCorrections();
  if (!data || !correction) {
    return NextResponse.json({ error: "Published V6 change data unavailable" }, { status: 404 });
  }
  const changes = data.slugs.map((slug) => ({
      slug,
      href: `/changes/${data.publicationKind === "v6_presentation_integration" ? data.releaseId : correction.recordRevisions[slug]!.universityRevisionId}/${slug}`,
      basisFingerprint: publishedV6School(slug, "en")!.fingerprint,
      reviewedDisplayClaimIds: v6SummaryAtRevision(slug, correction.revision)!.claims.map((claim) => claim.id),
      ...(data.publicationKind === "v6_presentation_integration"
        ? { addedClaimIds: [], updatedClaimIds: [], heldClaimIds: [], presentationChanged: true }
        : correction.changesBySlug[slug])
    }));
  return NextResponse.json({
    schemaVersion: "uapt-page-supplement-diff-v1",
    releaseId: data.releaseId,
    canonicalDatasetChanged: data.publicationKind === "v6_presentation_integration" ? false : true,
    publicationKind: data.publicationKind === "v6_presentation_integration"
      ? "v6_presentation_integration"
      : "scoped_record_correction",
    changes
  });
}
