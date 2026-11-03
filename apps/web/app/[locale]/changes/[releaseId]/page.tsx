import BasePage, { generateMetadata as baseGenerateMetadata } from "../../../(default)/changes/[releaseId]/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export async function generateStaticParams({ params }: { params: { locale: string } }) {
  return [];
}
export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = false;
export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  (params) => `/changes/${params.releaseId}`
);
export default createLocalizedSurfacePage(BasePage, "/changes/[releaseId]");
