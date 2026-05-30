import {
  getStaticUniversityIndexRecords,
  universityIndexRankingSystems
} from "@/lib/university-index-records";
import { JsonLd } from "@/components/json-ld";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { normalizeLocale } from "@/lib/i18n";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { UniversitiesIndexClient } from "./universities-index-client";

export const dynamic = "force-static";
export const revalidate = false;

const title = "Universities | University AI Policy Tracker";
const description =
  "Browse source-backed university AI policy records with ranks, review states, claim counts, official source attributions, and public JSON links.";

interface UniversitiesPageProps {
  params?: Promise<{
    locale?: string;
  }>;
}

export async function generateMetadata({
  params
}: UniversitiesPageProps = {}) {
  const locale = normalizeLocale((await params)?.locale);
  const alternates = getLocalizedAlternates("/universities", locale);
  const canonical = String(alternates.canonical);

  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website"
    }
  };
}

export default async function UniversitiesPage({ params }: UniversitiesPageProps) {
  const locale = normalizeLocale((await params)?.locale);
  const records = await getStaticUniversityIndexRecords();

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: title,
          description,
          url: getAbsoluteSiteUrl("/universities"),
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: records.length,
            itemListElement: records.slice(0, 20).map((record, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: record.name,
              url: getAbsoluteSiteUrl(`/universities/${record.slug}`)
            }))
          }
        }}
      />
      <UniversitiesIndexClient
        locale={locale}
        records={records}
        rankingSystems={universityIndexRankingSystems}
      />
    </>
  );
}
