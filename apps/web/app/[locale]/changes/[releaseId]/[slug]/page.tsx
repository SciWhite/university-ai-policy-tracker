import BasePage, { generateMetadata as baseGenerateMetadata } from "../../../../(default)/changes/[releaseId]/[slug]/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export async function generateStaticParams({ params }: { params: { locale: string } }) {
  return [];
}
export const dynamic = "force-dynamic";
export const dynamicParams = true;
export const revalidate = false;
export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  (params) => `/changes/${params.releaseId}/${params.slug}`
);
export default createLocalizedSurfacePage(BasePage, "/changes/[releaseId]/[slug]");
