import BasePage, { generateMetadata as baseGenerateMetadata } from "../../../(default)/universities/[slug]/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export const dynamicParams = true;
export const revalidate = false;
export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  (params) => `/universities/${params.slug}`
);
export default createLocalizedSurfacePage(BasePage);
