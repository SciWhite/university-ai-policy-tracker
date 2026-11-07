import React from "react";
import type { Metadata } from "next";
import { releaseDiffEventState } from "@/lib/change-index-evidence";
import { isConfirmedEmptyDiff, emptyDiffMetadata } from "@/lib/change-index-policy";
import {ChangeRevisionPage} from "@/components/change-history-pages";
import {changeHistoryMetadata} from "@/lib/change-history-view";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NO_ADVICE_BOUNDARY } from "@uapt/shared";
import { DiffBlock } from "@/components/diff-block";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import { getReleaseChangeRecord } from "@/lib/change-records";
import { JsonLd } from "@/components/json-ld";
import { getCatalogUniversityBySlug } from "@/lib/catalog";
import { withLocalePrefix, normalizeLocale } from "@/lib/i18n";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";
import { getLatestReleaseDiff } from "@/lib/release-diffs";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { redirectAliasSlugPage } from "@/lib/entity-alias-redirect";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { readPublishedV6Revision } from "@/lib/policy-v6-published";
import { V6ChangeDetail } from "@/components/v6-change-detail";
import { contentTagFor, tagContent } from "@/lib/content-cache-tags";
import { formatSchoolChangeDescription } from "@/lib/change-history-view";

interface ReleaseEntityChangePageProps {
  params: Promise<{
    locale?: string;
    releaseId: string;
    slug: string;
  }>;
}

// Rendered on first request from the active content release and cached until a content
// switch invalidates its tags, like /changes/[releaseId]. Nothing here reads request data.
export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = false;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: ReleaseEntityChangePageProps): Promise<Metadata> {
  const { locale: localeParam, releaseId, slug } = await params;
  const locale = normalizeLocale(localeParam);
  await redirectAliasSlugPage(slug, locale, (canonicalSlug) => `/changes/${releaseId}/${canonicalSlug}`);
  await tagContent("changes", contentTagFor.changesRelease(releaseId), contentTagFor.school(slug));
  const eventMetadata=await changeHistoryMetadata(slug,locale,releaseId);
  if(eventMetadata)return eventMetadata;
  const v6Revision = readPublishedV6Revision(releaseId);
  if (v6Revision) {
    if (![...v6Revision.slugs, ...(v6Revision.v5Slugs ?? [])].includes(slug)) notFound();
    const university = await getCatalogUniversityBySlug(slug);
    const displayName = university
      ? getLocalizedInstitutionName(slug, university.name, locale)
      : slug;
    const title = `${displayName} policy evidence history: ${releaseId} | University AI Policy Tracker`;
    const description = formatSchoolChangeDescription(displayName, releaseId, locale);
    return {
      title,
      description,
      alternates: getLocalizedAlternates(`/changes/${releaseId}/${slug}`, "en"),
      openGraph: { title, description, url: getAbsoluteSiteUrl(`/changes/${releaseId}/${slug}`), type: "article" }
    };
  }
  const record = await getReleaseChangeRecord(releaseId, slug);
  const canonical = getAbsoluteSiteUrl(`/changes/${releaseId}/${slug}`);
  const displayName = record
    ? getLocalizedInstitutionName(record.slug, record.name, locale)
    : undefined;
  const title = record
    ? `${displayName} AI Policy Tracker Release Diff: ${releaseId}`
    : "Release change record not found";
  const description = displayName
    ? formatSchoolChangeDescription(displayName, releaseId, locale)
    : "University AI Policy Tracker release change record not found.";

  const confirmedEmpty = record && isConfirmedEmptyDiff(record, {releaseId, locale: "en", alias: false, eventState: await releaseDiffEventState(releaseId, slug)});
  const empty = confirmedEmpty && locale === "en";
  return {
    title,
    description,
    alternates: getLocalizedAlternates(`/changes/${releaseId}/${slug}`, "en"),
    ...(confirmedEmpty ? {alternates: {canonical: getAbsoluteSiteUrl((locale === "en" ? "" : `/${locale}`) + `/changes/${releaseId}/${slug}`), languages: {}}} : {}),
    ...(empty ? emptyDiffMetadata(canonical) : {}),
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
  await redirectAliasSlugPage(slug, locale, (canonicalSlug) => `/changes/${releaseId}/${canonicalSlug}`);
  const eventPage=await ChangeRevisionPage({slug,revision:releaseId,locale});
  if(eventPage)return eventPage;
  const v6Revision = readPublishedV6Revision(releaseId);
  if (v6Revision) {
    if (![...v6Revision.slugs, ...(v6Revision.v5Slugs ?? [])].includes(slug)) notFound();
    return <V6ChangeDetail revision={releaseId} slug={slug} locale={locale} />;
  }
  const record = await getReleaseChangeRecord(releaseId, slug);

  if (!record) {
    notFound();
  }
  const displayName = getLocalizedInstitutionName(record.slug, record.name, locale);
  const canonicalUrl = getAbsoluteSiteUrl(withLocalePrefix(`/changes/${releaseId}/${slug}`, locale));
  const pageDescription = formatSchoolChangeDescription(displayName, releaseId, locale);

  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: `${displayName} — ${releaseId}`,
          description: pageDescription,
          url: canonicalUrl,
          inLanguage: locale,
          isPartOf: {
            "@type": "WebSite",
            name: "University AI Policy Tracker",
            url: getAbsoluteSiteUrl("/")
          },
          breadcrumb: {
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: getAbsoluteSiteUrl(withLocalePrefix("/", locale))
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Changes",
                item: getAbsoluteSiteUrl(withLocalePrefix("/changes", locale))
              },
              {
                "@type": "ListItem",
                position: 3,
                name: releaseId,
                item: getAbsoluteSiteUrl(withLocalePrefix(`/changes/${releaseId}`, locale))
              },
              {
                "@type": "ListItem",
                position: 4,
                name: displayName,
                item: canonicalUrl
              }
            ]
          }
        }}
      />
      {record.publicationKind === "scoped_record_correction" ? (
        <p className="notice-card">
          {"Tracker audit correction:"} <span data-i18n="preserve">{typeof record.changeSummary === "object" && record.changeSummary !== null ? ((record.changeSummary as any)[locale] || (record.changeSummary as any).en) : record.changeSummary}</span> {"Published in the tracker on"} <span data-i18n="preserve">{record.lastChangedAt}</span>. {"This date does not establish a university policy publication or effective date. Historical global releases remain unchanged. Student summary approval is tracked separately."}
        </p>
      ) : null}
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
