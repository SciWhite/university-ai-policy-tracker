import {withSourceHashContract} from "@/lib/source-hash-contract";
import { buildPublicEntitySummaryResponse } from "@uapt/shared";
import { NextResponse } from "next/server";
import {
  getCatalogUniversities,
  getPublicUniversitySummaryBySlug
} from "@/lib/catalog";
import { getAliasSlugs, getCanonicalSlugForAlias } from "@/lib/entity-aliases";
import { getPublicUniversityPolicySnapshotLink } from "@/lib/policy-snapshots";
import { getSiteBaseUrl } from "@/lib/site-url";
import {
  readV6RecordCorrections,
  readV6RecordCorrectionRevision,
  v6BaselineRevision,
  v6RecordRevision,
  v6SummaryAtRevision
} from "@/lib/v6-effective-records";

export const dynamic = "force-dynamic";
// Revision URLs are addressed by published record history, not the base roster.
export const dynamicParams = true;

interface PublicUniversityRouteProps {
  params: Promise<{
    slug: string[];
  }>;
}

export async function generateStaticParams() {
  const universities = await getCatalogUniversities();
  const aliasSlugs = await getAliasSlugs();

  return [...universities.map((university) => university.slug), ...aliasSlugs].flatMap(
    (slug) => [{ slug: [slug] }, { slug: [`${slug}.json`] }]
  );
}

export async function GET(_request: Request, { params }: PublicUniversityRouteProps) {
  const { slug } = await params;
  const slugPath = slug.join("/");

  const history = slugPath.match(/^([a-z0-9-]+)\/revisions\/([a-z0-9-]+)\.json$/);
  if (history) {
    const [, universitySlug, revision] = history;
    const corrections = readV6RecordCorrections();
    if (!corrections) {
      return NextResponse.json({ error: "Record revision not found" }, { status: 404 });
    }
    const isBaseline = revision === v6BaselineRevision(universitySlug, corrections);
    const selected = isBaseline ? corrections : readV6RecordCorrectionRevision(revision);
    if (!selected) {
      return NextResponse.json({ error: "Record revision not found" }, { status: 404 });
    }
    const record = isBaseline
      ? selected.historical[universitySlug]?.baseline
      : v6SummaryAtRevision(universitySlug, selected.revision);
    if (!record) {
      return NextResponse.json(
        { error: "University not present in this historical revision" },
        { status: 404 }
      );
    }
    const historical = isBaseline || selected.revision !== corrections.revision;
    return NextResponse.json({
      ...withSourceHashContract(
        buildPublicEntitySummaryResponse(record, "https://eduaipolicy.org"),
        record
      ),
      recordRevision: revision,
      historical,
      heldClaims: isBaseline
        ? selected.historical[universitySlug]!.heldClaims
        : selected.heldBySlug[universitySlug],
      historicalSnapshot: isBaseline
        ? selected.historical[universitySlug]!.snapshot
        : undefined,
      notice: historical
        ? "Historical version; not current permission or snapshot approval."
        : "Current scoped reviewed record."
    });
  }

  const hasJsonSuffix = slugPath.endsWith(".json");
  const universitySlug = hasJsonSuffix
    ? slugPath.slice(0, -".json".length)
    : slugPath;
  const canonicalSlug = await getCanonicalSlugForAlias(universitySlug);

  if (canonicalSlug) {
    return NextResponse.redirect(
      new URL(
        `/api/public/v1/universities/${canonicalSlug}${hasJsonSuffix ? ".json" : ""}`,
        getSiteBaseUrl()
      ),
      308
    );
  }
  const summary = await getPublicUniversitySummaryBySlug(universitySlug);

  if (!summary) {
    return NextResponse.json(
      { error: `University not found: ${universitySlug}` },
      { status: 404 }
    );
  }

  const policySnapshot = await getPublicUniversityPolicySnapshotLink(
    summary.entity.slug,
    getSiteBaseUrl()
  );
  const summaryWithOptionalSnapshot = policySnapshot
    ? { ...summary, policySnapshot }
    : summary;

  const response = withSourceHashContract(
    buildPublicEntitySummaryResponse(summaryWithOptionalSnapshot, getSiteBaseUrl()),
    summary
  );
  const revision = v6RecordRevision(universitySlug);
  if (revision) {
    return NextResponse.json({
      ...response,
      recordRevision: revision,
      historicalRecordsUrl: `https://eduaipolicy.org/api/public/v1/universities/${universitySlug}/revisions/${v6BaselineRevision(universitySlug)}.json`
    }, { headers: { "Cache-Control": "private, no-store, no-transform" } });
  }
  return NextResponse.json(response);
}
