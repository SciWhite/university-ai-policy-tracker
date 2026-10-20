import {
  getStaticUniversityIndexRecords,
  universityIndexRankingSystems,
} from "@/lib/university-index-records";
import { getStagedPublicDataset } from "@/lib/staged-public-data";
import { JsonLd } from "@/components/json-ld";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { normalizeLocale } from "@/lib/i18n";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";
import { getPageCopy } from "@/lib/page-copy";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { getDiscoveryTopicKeys } from "@/lib/discovery-topic-groups";
import { UniversitiesIndexClient } from "./universities-index-client";

export const dynamic = "force-static";
export const revalidate = false;

interface UniversitiesPageProps {
  params?: Promise<{
    locale?: string;
  }>;
}

export async function generateMetadata({ params }: UniversitiesPageProps = {}) {
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
      type: "website",
    },
  };
}

export default async function UniversitiesPage({
  params,
}: UniversitiesPageProps) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).universities;
  const records = await getStaticUniversityIndexRecords();
  const initialRecords = getInitialUniversityIndexRecords(records);
  const dataset = await getStagedPublicDataset();
  const topicIndex = Object.fromEntries(
    dataset.publicSummaries.map((summary) => [
      summary.entity.slug,
      [...new Set(summary.claims.flatMap(getDiscoveryTopicKeys))],
    ]),
  );
  const countries = [
    ...new Set(records.map((record) => record.country)),
  ].sort();

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
            itemListElement: initialRecords
              .slice(0, 20)
              .map((record, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: getLocalizedInstitutionName(
                  record.slug,
                  record.name,
                  locale,
                ),
                url: getAbsoluteSiteUrl(`/universities/${record.slug}`),
              })),
          },
        }}
      />
      <UniversitiesIndexClient
        universityNames={Object.fromEntries(
          records.map((r) => [r.slug, r.name]),
        )}
        countries={countries}
        topicIndex={topicIndex}
        initialRecords={initialRecords}
        locale={locale}
        rankingSystems={universityIndexRankingSystems.map((system) => {
          const years = [
            ...new Set(
              records.flatMap((record) =>
                record.rankings
                  .filter((ranking) => ranking.systemId === system.id)
                  .map((ranking) => ranking.rankingYear),
              ),
            ),
          ].sort();
          return {
            ...system,
            label: `${system.label} ${years.join(" / ")}`.trim(),
          };
        })}
        totalRecordCount={records.length}
      />
    </>
  );
}

function getInitialUniversityIndexRecords(
  records: Awaited<ReturnType<typeof getStaticUniversityIndexRecords>>,
) {
  return records
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 100);
}
