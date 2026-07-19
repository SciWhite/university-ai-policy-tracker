import BasePage, { generateMetadata as baseGenerateMetadata, generateStaticParams } from "../../../../(default)/changes/[releaseId]/[slug]/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export { generateStaticParams };
export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = false;
export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  (params) => `/changes/${params.releaseId}/${params.slug}`
);
export default createLocalizedSurfacePage(BasePage);
