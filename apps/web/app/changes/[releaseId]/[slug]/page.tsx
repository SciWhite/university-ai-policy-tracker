import Link from "next/link";
import { notFound } from "next/navigation";
import { NO_ADVICE_BOUNDARY } from "@uapt/shared";
import { DiffBlock } from "@/components/diff-block";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import { getReleaseChangeRecords } from "@/lib/change-records";
import { getLatestReleaseDiff } from "@/lib/release-diffs";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

interface ReleaseEntityChangePageProps {
  params: Promise<{
    releaseId: string;
    slug: string;
  }>;
}

export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = false;

export async function generateStaticParams() {
  const releaseDiff = await getLatestReleaseDiff().catch(() => undefined);
  if (!releaseDiff) return [];

  return releaseDiff.entities
    .filter((entity) => entity.rows.length)
    .map((entity) => ({
      releaseId: entity.currentReleaseId,
      slug: entity.entitySlug
    }));
}

export async function generateMetadata({ params }: ReleaseEntityChangePageProps) {
  const { releaseId, slug } = await params;
  const record = (await getReleaseChangeRecords(releaseId))?.find(
    (item) => item.slug === slug
  );
  const canonical = getAbsoluteSiteUrl(`/changes/${releaseId}/${slug}`);
  const title = record
    ? `${record.name} AI Policy Changes: ${releaseId}`
    : "Release change record not found";
  const description = record
    ? `${record.name} claim/evidence diff for ${releaseId}: +${record.added}, -${record.removed}, ~${record.modified}.`
    : "University AI Policy Tracker release change record not found.";

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article"
    }
  };
}

export default async function ReleaseEntityChangePage({
  params
}: ReleaseEntityChangePageProps) {
  const { releaseId, slug } = await params;
  const record = (await getReleaseChangeRecords(releaseId))?.find(
    (item) => item.slug === slug
  );

  if (!record) notFound();

  return (
    <main className="page-shell page-shell--wide">
      <section className="entity-header">
        <div className="entity-header__main">
          <p className="entity-header__eyebrow">Release diff</p>
          <h1>{record.name}</h1>
          <p className="entity-header__summary">
            Unified claim/evidence diff for {releaseId}. Full source-page text is
            not published; short original-language evidence snippets are shown
            for citation context.
          </p>
          <div className="entity-header__metadata">
            <StateLabel reviewState={record.reviewState} />
            <MetaLabel label="Release">{releaseId}</MetaLabel>
            {record.previousReleaseId ? (
              <MetaLabel label="Previous">{record.previousReleaseId}</MetaLabel>
            ) : null}
            <MetaLabel label="Added">{record.added}</MetaLabel>
            <MetaLabel label="Removed">{record.removed}</MetaLabel>
            <MetaLabel label="Modified">{record.modified}</MetaLabel>
          </div>
        </div>
        <div className="entity-header__actions">
          <Link className="site-action" href={`/changes/${record.slug}`}>
            Latest diff
          </Link>
          <Link className="site-action" href={record.universityUrl}>
            University page
          </Link>
          <a
            className="site-action"
            href={`/api/public/v1/changes/${releaseId}/${record.slug}.json`}
          >
            Diff JSON
          </a>
        </div>
      </section>

      <ReferenceBox
        description="Release-to-release claim/evidence changes generated from public release snapshots."
        title="Unified diff"
      >
        {record.diffLines.length ? (
          <DiffBlock
            description={
              record.previousReleaseId
                ? `Comparing ${record.previousReleaseId} to ${releaseId}.`
                : "Initial tracked release."
            }
            lines={record.diffLines}
            title={`${record.name} ${releaseId} diff`}
          />
        ) : (
          <p className="notice-card">
            No claim/evidence changes are recorded for this university in this
            release.
          </p>
        )}
      </ReferenceBox>

      <section className="section">
        <div className="section-heading">
          <h2>Boundary</h2>
          <p>Tracker metadata only</p>
        </div>
        <p className="notice-card">{NO_ADVICE_BOUNDARY}</p>
      </section>
    </main>
  );
}
