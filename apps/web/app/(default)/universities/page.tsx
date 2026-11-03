import { DiscoveryJsonLd } from "@/components/discovery-json-ld";
import { getDiscoveryPage } from "@/lib/rankings-view-data";
import type { DiscoverySearchParams } from "@/lib/discovery-query";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { normalizeReadingLocale, legacyLocale } from "@/lib/i18n";
import { getPageCopy } from "@/lib/page-copy";
import { UniversitiesIndexClient } from "./universities-index-client";
import { ReadingUiTextProvider } from "@/components/reading-ui-text-provider";
import { getReadingSharedUiText } from "@/lib/reading-translations";

export const dynamic = "force-dynamic";
export const revalidate = false;

interface UniversitiesPageProps {
  searchParams?: Promise<DiscoverySearchParams>;
  params?: Promise<{
    locale?: string;
  }>;
}

export async function generateMetadata({ params }: UniversitiesPageProps) {
  const locale = normalizeReadingLocale((await params)?.locale);
  const copy = getPageCopy(locale).universities;
  const alternates = getLocalizedAlternates("/universities", legacyLocale(locale));
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
  searchParams,
}: UniversitiesPageProps) {
  const locale = normalizeReadingLocale((await params)?.locale);
  const data = await getDiscoveryPage(
    "universities",
    (await searchParams) ?? {},
    locale,
  );
  const locationText = await getReadingSharedUiText(locale, [...data.countries, ...data.rows.flatMap(row => [row.country, row.region])]);
  return (
    <ReadingUiTextProvider value={locationText}>
      <DiscoveryJsonLd
        data={data}
        locale={locale}
        pathname="/universities"
        title={getPageCopy(locale).universities.title}
      />
      <UniversitiesIndexClient data={data} locale={locale} />
    </ReadingUiTextProvider>
  );
}
