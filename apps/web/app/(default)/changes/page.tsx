import { PUBLIC_API_VERSION, NO_ADVICE_BOUNDARY } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { CitationCopyActions } from "@/components/citation-copy-actions";
import { JsonLd } from "@/components/json-ld";
import { ReferenceBox } from "@/components/reference-box";
import {
  compareChangeIndexRecords,
  defaultChangeIndexFilters
} from "@/lib/change-index-filters";
import { getChangeIndexData } from "@/lib/change-records";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { localizeHref, normalizeLocale } from "@/lib/i18n";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";
import { getChangesIndexClientCopy, getPageCopy } from "@/lib/page-copy";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { translateSurfaceText } from "@/lib/surface-localization";
import { ChangesIndexClient } from "./changes-index-client";

// Static shell + client filter island (same pattern as /universities): filters
// come from the URL client-side, so crawlers and cold starts get a prebuilt
// page instead of re-scanning the dataset per request.
export const dynamic = "force-static";
export const revalidate = false;

const initialRecordCount = 100;

interface ChangesPageProps {
  params?: Promise<{
    locale?: string;
  }>;
}

export async function generateMetadata({
  params
}: ChangesPageProps = {}) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).changes;
  const alternates = getLocalizedAlternates("/changes", locale);
  const canonical = String(alternates.canonical);

  return {
    title: copy.title,
    description: copy.description,
    alternates,
    openGraph: {
      title: copy.title,
      description: copy.description,
      url: canonical,
      type: "website"
    }
  };
}

export default async function ChangesPage({ params }: ChangesPageProps) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).changes;
  const index = await getChangeIndexData();
  const sortedRecords = [...index.data.records].sort((left, right) =>
    compareChangeIndexRecords(left, right, defaultChangeIndexFilters.sort)
  );
  const initialRecords = sortedRecords.slice(0, initialRecordCount);
  const canonical = getAbsoluteSiteUrl(localizeHref("/changes", locale));
  const publicJsonUrl = index.publicJsonUrl;
  const citationText = `University AI Policy Tracker changes index. University AI Policy Tracker. Version v1. ${canonical}`;

  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: copy.title,
          description: copy.description,
          url: canonical,
          isPartOf: {
            "@type": "WebSite",
            name: "University AI Policy Tracker",
            url: getAbsoluteSiteUrl("/")
          },
          mainEntity: {
            "@type": "ItemList",
            name: "University AI policy change timeline",
            numberOfItems: index.data.summary.recordCount,
            itemListElement: sortedRecords.slice(0, 10).map((record, position) => ({
              "@type": "ListItem",
              position: position + 1,
              url: getAbsoluteSiteUrl(localizeHref(record.changeUrl, locale)),
              name: getLocalizedInstitutionName(record.slug, record.name, locale)
            }))
          }
        }}
      />

      <section className="hero">
        <p className="kicker">{copy.kicker}</p>
        <h1>{copy.heading}</h1>
      </section>

      <ReferenceBox
        className="compact-reference-box"
        description={copy.artifactDescription}
        title={copy.artifactTitle}
        actions={
          <CitationCopyActions
            canonicalUrl={canonical}
            citationText={citationText}
            publicJsonUrl={publicJsonUrl}
          />
        }
      >
        <p>{copy.indexJsonDescription}</p>
        <ApiEndpointRow
          description={copy.indexJsonDescription}
          label={copy.indexJson}
          path="/api/public/v1/changes/index.json"
          url={publicJsonUrl}
        />
        <ApiEndpointRow
          description={copy.recentChangesJsonDescription}
          label={copy.recentChangesJson}
          path={`/api/public/${PUBLIC_API_VERSION}/recent-changes.json`}
          url={getAbsoluteSiteUrl(
            `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`
          )}
        />
        <ApiEndpointRow
          description={copy.latestDiffJsonDescription}
          label={copy.latestDiffJson}
          path={`/api/public/${PUBLIC_API_VERSION}/changes/latest.json`}
          url={getAbsoluteSiteUrl(
            `/api/public/${PUBLIC_API_VERSION}/changes/latest.json`
          )}
        />
      </ReferenceBox>

      <ChangesIndexClient
        copy={getChangesIndexClientCopy(locale)}
        facets={index.data.facets}
        fallbackNotice={translateSurfaceText(NO_ADVICE_BOUNDARY, locale)}
        initialRecords={initialRecords}
        locale={locale}
        totalSummary={index.data.summary}
      />

      <section className="section">
        <div className="section-heading">
          <h2>{copy.boundaryTitle}</h2>
          <p>{copy.boundaryLead}</p>
        </div>
        <p className="notice-card">{NO_ADVICE_BOUNDARY}</p>
      </section>
    </main>
  );
}
