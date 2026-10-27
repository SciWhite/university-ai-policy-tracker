import { RankingEditionView } from "./ranking-edition-view";
import { getRankingEdition } from "@/lib/ranking-editions";
import { parseDiscoveryQuery } from "@/lib/discovery-query";
import type { DiscoverySearchParams } from "@/lib/discovery-query";
import type { SupportedLocale } from "@/lib/i18n";
export function RankingsIndexView({
  locale,
  searchParams = {},
}: {
  locale: SupportedLocale;
  searchParams?: DiscoverySearchParams;
}) {
  const candidate = parseDiscoveryQuery(searchParams, "rankings").edition;
  return (
    <RankingEditionView
      locale={locale}
      slug={getRankingEdition(candidate ?? "")?.slug ?? "qs-2027"}
      pathname="/rankings"
      searchParams={searchParams}
    />
  );
}
