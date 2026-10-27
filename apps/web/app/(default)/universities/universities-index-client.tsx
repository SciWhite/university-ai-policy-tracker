"use client";
import { RankingRecordsView } from "@/components/ranking-records-view";
import type { DiscoveryPageData } from "@/lib/rankings-view-data";
import type { SupportedLocale } from "@/lib/i18n";
export function UniversitiesIndexClient({
  data,
  locale,
}: {
  data: DiscoveryPageData;
  locale: SupportedLocale;
}) {
  return (
    <RankingRecordsView
      data={data}
      locale={locale}
      mode="universities"
      pathname="/universities"
    />
  );
}
