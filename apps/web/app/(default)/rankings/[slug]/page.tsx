import { rankingBrowserCopy } from "@/lib/ranking-browser-copy";
import type { DiscoverySearchParams } from "@/lib/discovery-query";
import { RankingEditionView } from "@/components/ranking-edition-view";
import {
  getRankingLandingSpec,
  rankingLandingSpecs,
} from "@/lib/reference-pages";
import { rankingsCopy } from "@/lib/rankings-copy";
import { normalizeLocale } from "@/lib/i18n";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
interface RankingPageProps {
  searchParams?: Promise<DiscoverySearchParams>;
  params: Promise<{ locale?: string; slug: string }>;
}
export const dynamic = "force-dynamic";
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
  const title = spec
    ? `${spec.label} · ${rankingBrowserCopy(locale).rankings}`
    : copy.title;
  const alternates = getLocalizedAlternates(`/rankings/${slug}`, locale);
  return {
    title: `${title} | University AI Policy Tracker`,
    description: rankingBrowserCopy(locale).rankingNote,
    alternates,
    openGraph: {
      title,
      description: rankingBrowserCopy(locale).rankingNote,
      url: String(alternates.canonical),
      type: "website",
    },
  };
}
export default async function RankingPage({
  params,
  searchParams,
}: RankingPageProps) {
  const { slug, locale: localeParam } = await params;
  return (
    <RankingEditionView
      locale={normalizeLocale(localeParam)}
      slug={slug}
      searchParams={(await searchParams) ?? {}}
    />
  );
}
