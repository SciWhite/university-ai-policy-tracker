import {
  getStaticUniversityIndexRecords,
  universityIndexRankingSystems
} from "@/lib/university-index-records";
import { JsonLd } from "@/components/json-ld";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { normalizeLocale } from "@/lib/i18n";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";
import { getPageCopy } from "@/lib/page-copy";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { UniversitiesIndexClient } from "./universities-index-client";

export const dynamic = "force-static";
export const revalidate = false;

interface UniversitiesPageProps {
  params?: Promise<{
    locale?: string;
  }>;
}

export async function generateMetadata({
  params
}: UniversitiesPageProps = {}) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).universities;
  const alternates = getLocalizedAlternates("/universities", locale);
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

export default async function UniversitiesPage({ params }: UniversitiesPageProps) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).universities;
  const records = await getStaticUniversityIndexRecords();

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: copy.title,
          description: copy.description,
          url: getAbsoluteSiteUrl("/universities"),
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: records.length,
            itemListElement: records.slice(0, 20).map((record, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: getLocalizedInstitutionName(record.slug, record.name, locale),
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
