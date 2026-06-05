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
  const initialRecords = getInitialUniversityIndexRecords(records);
  const totalClaimCount = records.reduce(
    (total, record) => total + record.claimCount,
    0
  );
  const totalReviewedClaimCount = records.reduce(
    (total, record) => total + record.reviewedClaimCount,
    0
  );
  const totalSourceCount = records.reduce(
    (total, record) => total + record.sourceCount,
    0
  );
  const rankingCounts = Object.fromEntries(
    universityIndexRankingSystems.map((system) => [
      system.id,
      records.filter((record) =>
        record.rankings.some((ranking) => ranking.systemId === system.id)
      ).length
    ])
  );

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
        initialRecords={initialRecords}
        locale={locale}
        rankingCounts={rankingCounts}
        rankingSystems={universityIndexRankingSystems}
        totalClaimCount={totalClaimCount}
        totalRecordCount={records.length}
        totalReviewedClaimCount={totalReviewedClaimCount}
        totalSourceCount={totalSourceCount}
      />
    </>
  );
}

function getInitialUniversityIndexRecords(
  records: Awaited<ReturnType<typeof getStaticUniversityIndexRecords>>
) {
  return records
    .slice()
    .sort((left, right) => {
      const leftRank = left.rankings.find((ranking) => ranking.systemId === "qs");
      const rightRank = right.rankings.find(
        (ranking) => ranking.systemId === "qs"
      );

      return (
        (leftRank?.rankNumber ?? Number.MAX_SAFE_INTEGER) -
          (rightRank?.rankNumber ?? Number.MAX_SAFE_INTEGER) ||
        left.name.localeCompare(right.name)
      );
    })
    .slice(0, 100);
}
