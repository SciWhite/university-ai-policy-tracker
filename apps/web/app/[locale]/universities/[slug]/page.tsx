import BasePage, { generateMetadata as baseGenerateMetadata } from "../../../(default)/universities/[slug]/page";
import { createLocalizedSurfaceMetadata } from "@/lib/surface-localization-server";
import { createLocalizedSurfacePage } from "@/lib/surface-localization";

export const dynamicParams = true;
export const revalidate = 3600;
export function generateStaticParams(): Array<{ locale: string; slug: string }> {
  return [];
}
export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  (params) => `/universities/${params.slug}`
);
export default createLocalizedSurfacePage(BasePage);
