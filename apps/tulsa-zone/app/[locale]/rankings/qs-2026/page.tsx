import QsRankingPage, { generateMetadata as baseMetadata } from "@/components/qs-ranking-page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export const dynamic = "force-dynamic";
export const generateMetadata = createLocalizedSurfaceMetadata(
  baseMetadata as (props: unknown) => ReturnType<typeof baseMetadata>,
  "/rankings/qs-2026",
);
export default createLocalizedSurfacePage(QsRankingPage);
