import { RankingEditionView } from "./ranking-edition-view";
import type { SupportedLocale } from "@/lib/i18n";
export function RankingsIndexView({ locale }: { locale: SupportedLocale }) {
  return (
    <RankingEditionView
      locale={locale}
      slug="usnews-2025-2026"
      pathname="/rankings"
    />
  );
}
