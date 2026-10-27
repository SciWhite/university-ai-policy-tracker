import { DiscoveryJsonLd } from "./discovery-json-ld";
import { notFound } from "next/navigation";
import { RankingRecordsView } from "./ranking-records-view";
import { getDiscoveryPage } from "@/lib/rankings-view-data";
import { getRankingEdition } from "@/lib/ranking-editions";
import type { DiscoverySearchParams } from "@/lib/discovery-query";
import type { SupportedLocale } from "@/lib/i18n";
export async function RankingEditionView({
  locale,
  slug,
  pathname = `/rankings/${slug}`,
  searchParams = {},
}: {
  locale: SupportedLocale;
  slug: string;
  pathname?: string;
  searchParams?: DiscoverySearchParams;
}) {
  if (!getRankingEdition(slug)) notFound();
  const data = await getDiscoveryPage("rankings", searchParams, locale, slug);
  return (
    <>
      <DiscoveryJsonLd
        data={data}
        locale={locale}
        pathname={pathname}
        title={getRankingEdition(slug)!.label}
      />
      <RankingRecordsView data={data} locale={locale} pathname={pathname} />
    </>
  );
}
