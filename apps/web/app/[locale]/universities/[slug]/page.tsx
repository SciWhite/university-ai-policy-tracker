import BasePage, { generateMetadata as baseGenerateMetadata } from "../../../(default)/universities/[slug]/page";
import { createLocalizedSurfaceMetadata } from "@/lib/surface-localization-server";
import { createLocalizedSurfacePage } from "@/lib/surface-localization";

// Render once per content release; see the (default) route.
export const dynamicParams = true;
export const revalidate = false;
export function generateStaticParams(): Array<{ locale: string; slug: string }> {
  return [];
}
export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  (params) => `/universities/${params.slug}`
);
export default createLocalizedSurfacePage(BasePage);
