import RankingPage, {
  generateMetadata as rankingMetadata,
} from "@/app/(default)/rankings/[slug]/page";

interface QsRankingPageProps {
  params?: Promise<{ locale?: string }>;
}

function rankingProps({ params }: QsRankingPageProps) {
  return {
    params: Promise.resolve(params).then(value => ({ ...value, slug: "qs-2026" })),
  };
}

export function generateMetadata(props: QsRankingPageProps = {}) {
  return rankingMetadata(rankingProps(props));
}

export default function QsRankingPage(props: QsRankingPageProps = {}) {
  return RankingPage(rankingProps(props));
}
