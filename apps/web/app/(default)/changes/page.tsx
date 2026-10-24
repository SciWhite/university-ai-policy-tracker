import { PUBLIC_API_VERSION, NO_ADVICE_BOUNDARY } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { CitationCopyActions } from "@/components/citation-copy-actions";
import { discoveryCopy } from "@/lib/discovery-copy";
import { DocumentLink as Link } from "@/components/document-link";
import { JsonLd } from "@/components/json-ld";
import { ReferenceBox } from "@/components/reference-box";
import {
  compareChangeIndexRecords,
  defaultChangeIndexFilters,
} from "@/lib/change-index-filters";
import { getChangeIndexData } from "@/lib/change-records";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { localizeHref, normalizeLocale } from "@/lib/i18n";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";
import { getChangesIndexClientCopy, getPageCopy } from "@/lib/page-copy";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { translateSurfaceText } from "@/lib/surface-localization";
import { CopyCurrentLink } from "@/components/copy-current-link";
import { DiscoveryIcon } from "@/components/discovery-ui";
import { ChangesIndexClient } from "./changes-index-client";
import {ChangeIndexEventsPage} from "@/components/change-index-events-page";
import {selectedEventIndex} from "@/lib/change-index-events-api";
import {changeIndexEventsCopy} from "@/lib/change-index-events-copy";

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

export async function generateMetadata({ params }: ChangesPageProps) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).changes;
  let eventView=false;try{eventView=Boolean(await selectedEventIndex(locale));}catch{eventView=true;}
  const title=eventView?changeIndexEventsCopy(locale).title:copy.title,description=eventView?changeIndexEventsCopy(locale).scope:copy.description;
  const alternates = getLocalizedAlternates("/changes", locale);
  const canonical = String(alternates.canonical);

  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
    },
  };
}

export default async function ChangesPage({ params }: ChangesPageProps) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).changes;
  const events=await ChangeIndexEventsPage({locale});if(events)return events;
  const ui = discoveryCopy(locale);
  const index = await getChangeIndexData();
  const sortedRecords = [...index.data.records].sort((left, right) =>
    compareChangeIndexRecords(left, right, defaultChangeIndexFilters.sort),
  );
  const initialRecords = sortedRecords.slice(0, initialRecordCount);
  const canonical = getAbsoluteSiteUrl(localizeHref("/changes", locale));
  const publicJsonUrl = index.publicJsonUrl;
  const citationText = `University AI Policy Tracker changes index. University AI Policy Tracker. Version v1. ${canonical}`;

  return (
    <main className="discovery-page" data-discovery-page="changes">
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
            url: getAbsoluteSiteUrl("/"),
          },
          mainEntity: {
            "@type": "ItemList",
            name: "University AI policy change timeline",
            numberOfItems: index.data.summary.recordCount,
            itemListElement: sortedRecords
              .slice(0, 10)
              .map((record, position) => ({
                "@type": "ListItem",
                position: position + 1,
                url: getAbsoluteSiteUrl(localizeHref(record.changeUrl, locale)),
                name: getLocalizedInstitutionName(
                  record.slug,
                  record.name,
                  locale,
                ),
              })),
          },
        }}
      />

      <header className="discovery-header">
        <div>
          <h1>{ui.changesTitle}</h1>
          <p>{ui.changesLead}</p>
        </div>
        <div className="discovery-header-actions">
          <Link
            className="discovery-outline-link"
            href="/feeds/recent-changes.xml"
          >
            <DiscoveryIcon name="rss" /> {ui.rss}
          </Link>
          <CopyCurrentLink locale={locale} />
        </div>
      </header>

      <ChangesIndexClient
        copy={getChangesIndexClientCopy(locale)}
        facets={index.data.facets}
        fallbackNotice={translateSurfaceText(NO_ADVICE_BOUNDARY, locale)}
        initialRecords={initialRecords}
        locale={locale}
        totalSummary={index.data.summary}
      >
        {" "}
        <details className="discovery-data">
          <summary>{ui.data}</summary>
          <div className="discovery-data-body">
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
                  `/api/public/${PUBLIC_API_VERSION}/recent-changes.json`,
                )}
              />
              <ApiEndpointRow
                description={copy.latestDiffJsonDescription}
                label={copy.latestDiffJson}
                path={`/api/public/${PUBLIC_API_VERSION}/changes/latest.json`}
                url={getAbsoluteSiteUrl(
                  `/api/public/${PUBLIC_API_VERSION}/changes/latest.json`,
                )}
              />
            </ReferenceBox>
          </div>
        </details>
      </ChangesIndexClient>
    </main>
  );
}
