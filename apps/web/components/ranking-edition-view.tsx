import { DiscoveryJsonLd } from "./discovery-json-ld";
import { notFound } from "next/navigation";
import { RankingRecordsView } from "./ranking-records-view";
import { getDiscoveryPage } from "@/lib/rankings-view-data";
import { getRankingEdition } from "@/lib/ranking-editions";
import type { DiscoverySearchParams } from "@/lib/discovery-query";
import type { ReadingLocale } from "@/lib/language-catalog";
import { getReadingSharedUiText } from "@/lib/reading-translations";
import { ReadingUiTextProvider } from "./reading-ui-text-provider";
export async function RankingEditionView({
  locale,
  slug,
  pathname = `/rankings/${slug}`,
  searchParams = {},
}: {
  locale: ReadingLocale;
  slug: string;
  pathname?: string;
  searchParams?: DiscoverySearchParams;
}) {
  if (!getRankingEdition(slug)) notFound();
  const data = await getDiscoveryPage("rankings", searchParams, locale, slug);
  const locations = [...data.countries, ...data.rows.flatMap(row => [row.country, row.region])];
  const locationText = await getReadingSharedUiText(locale, locations);
  return (
    <ReadingUiTextProvider value={locationText}>
      <DiscoveryJsonLd
        data={data}
        locale={locale}
        pathname={pathname}
        title={getRankingEdition(slug)!.label}
      />
      <RankingRecordsView data={data} locale={locale} pathname={pathname} />
    </ReadingUiTextProvider>
  );
}
