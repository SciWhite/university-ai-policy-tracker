import { RankingEditionView } from "@/components/ranking-edition-view";
import {
  getRankingLandingSpec,
  rankingLandingSpecs,
} from "@/lib/reference-pages";
import { rankingsCopy } from "@/lib/rankings-copy";
import { normalizeLocale } from "@/lib/i18n";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
interface RankingPageProps {
  params: Promise<{ locale?: string; slug: string }>;
}
export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;
export function generateStaticParams() {
  return rankingLandingSpecs.map((spec) => ({ slug: spec.slug }));
}
export async function generateMetadata({ params }: RankingPageProps) {
  const { slug, locale: localeParam } = await params;
  const locale = normalizeLocale(localeParam),
    spec = getRankingLandingSpec(slug),
    copy = rankingsCopy(locale);
  const title = spec ? `${spec.label} ${copy.heading}` : copy.title;
  const alternates = getLocalizedAlternates(`/rankings/${slug}`, locale);
  return {
    title: `${title} | University AI Policy Tracker`,
    description: copy.lead,
    alternates,
    openGraph: {
      title,
      description: copy.lead,
      url: String(alternates.canonical),
      type: "website",
    },
  };
}
export default async function RankingPage({ params }: RankingPageProps) {
  const { slug, locale: localeParam } = await params;
  return (
    <RankingEditionView locale={normalizeLocale(localeParam)} slug={slug} />
  );
}
