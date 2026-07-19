import BasePage, { generateMetadata as baseGenerateMetadata, generateStaticParams } from "../../../(default)/analysis/[slug]/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export { generateStaticParams };
export const dynamic = "force-static";
export const dynamicParams = false;
export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  (params) => `/analysis/${params.slug}`
);
export default createLocalizedSurfacePage(BasePage);
