import BasePage, { generateMetadata as baseGenerateMetadata, generateStaticParams } from "../../../(default)/regions/[slug]/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export { generateStaticParams };
export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = false;
export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  (params) => `/regions/${params.slug}`
);
export default createLocalizedSurfacePage(BasePage, "/regions/[slug]");
