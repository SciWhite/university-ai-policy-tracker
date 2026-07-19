import Link from "next/link";
import { notFound } from "next/navigation";
import { NO_ADVICE_BOUNDARY } from "@uapt/shared";
import { DiffBlock } from "@/components/diff-block";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import { getReleaseChangeRecords } from "@/lib/change-records";
import { normalizeLocale } from "@/lib/i18n";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";
import { getLatestReleaseDiff } from "@/lib/release-diffs";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";

interface ReleaseEntityChangePageProps {
  params: Promise<{
    locale?: string;
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
  const { locale: localeParam, releaseId, slug } = await params;
  const locale = normalizeLocale(localeParam);
  const record = (await getReleaseChangeRecords(releaseId))?.find(
    (item) => item.slug === slug
  );
  const canonical = getAbsoluteSiteUrl(`/changes/${releaseId}/${slug}`);
  const displayName = record
    ? getLocalizedInstitutionName(record.slug, record.name, locale)
    : undefined;
  const title = record
    ? `${displayName} AI Policy Tracker Release Diff: ${releaseId}`
    : "Release change record not found";
  const description = record
    ? `${displayName} tracker release diff for ${releaseId}: ${record.policyTextChanged} comparable policy-text changes, ${record.newlyExtractedClaims} newly extracted claims, ${record.sourceSnapshotChanged} source snapshot changes.`
    : "University AI Policy Tracker release change record not found.";

  return {
    title,
    description,
    alternates: getLocalizedAlternates(`/changes/${releaseId}/${slug}`, "en"),
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
  const { locale: localeParam, releaseId, slug } = await params;
  const locale = normalizeLocale(localeParam);
  const record = (await getReleaseChangeRecords(releaseId))?.find(
    (item) => item.slug === slug
  );

  if (!record) notFound();
  const displayName = getLocalizedInstitutionName(record.slug, record.name, locale);

  return (
    <main className="page-shell page-shell--wide">
      <section className="entity-header">
        <div className="entity-header__main">
          <p className="entity-header__eyebrow">Release diff</p>
          <h1 data-i18n="preserve">{displayName}</h1>
          <p className="entity-header__summary">
            Unified tracker diff for {releaseId}. Full source-page text is not
            published; short original-language evidence snippets are shown for
            citation context.
          </p>
          <div className="entity-header__metadata">
            <StateLabel reviewState={record.reviewState} />
            <MetaLabel label="Release">{releaseId}</MetaLabel>
            {record.previousReleaseId ? (
              <MetaLabel label="Previous">{record.previousReleaseId}</MetaLabel>
            ) : null}
            <MetaLabel label="Policy text">{record.policyTextChanged}</MetaLabel>
            <MetaLabel label="Newly extracted">
              {record.newlyExtractedClaims}
            </MetaLabel>
            <MetaLabel label="Source hash">
              {record.sourceSnapshotChanged}
            </MetaLabel>
            <MetaLabel label="Source text">
              {record.sourceTextChanged}
            </MetaLabel>
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
        description="Release-to-release tracker changes generated from public release snapshots."
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
            title={`${displayName} ${releaseId} diff`}
          />
        ) : (
          <p className="notice-card">
            No tracker diff rows are recorded for this university in this
            release.
          </p>
        )}
      </ReferenceBox>

      <section className="section">
        <div className="section-heading">
          <h2>How to read this diff</h2>
          <p>Tracker release metadata, not direct proof of university publication timing.</p>
        </div>
        <p className="notice-card">
          Newly extracted claims are tracker additions and are not necessarily
          newly published by the university. Source snapshot changes mean the
          same URL produced a different hash; that may be policy text, layout,
          navigation, or metadata.
        </p>
      </section>

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
