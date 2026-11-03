"use client";
import { RankingRecordsView } from "@/components/ranking-records-view";
import type { DiscoveryPageData } from "@/lib/rankings-view-data";
import type { ReadingLocale } from "@/lib/language-catalog";
export function UniversitiesIndexClient({
  data,
  locale,
}: {
  data: DiscoveryPageData;
  locale: ReadingLocale;
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
