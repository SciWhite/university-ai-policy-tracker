import { RankingsIndexView } from "@/components/rankings-index-view";
import { normalizeLocale } from "@/lib/i18n";
import { rankingsCopy } from "@/lib/rankings-copy";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
export const dynamic = "force-static";
export const revalidate = false;
interface Props {
  params?: Promise<{ locale?: string }>;
}
export async function generateMetadata({ params }: Props = {}) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = rankingsCopy(locale);
  const alternates = getLocalizedAlternates("/rankings", locale);
  return {
    title: `${copy.title} | University AI Policy Tracker`,
    description: copy.lead,
    alternates,
    openGraph: {
      title: copy.title,
      description: copy.lead,
      url: String(alternates.canonical),
      type: "website",
    },
  };
}
export default async function RankingsPage({ params }: Props) {
  return <RankingsIndexView locale={normalizeLocale((await params)?.locale)} />;
}
