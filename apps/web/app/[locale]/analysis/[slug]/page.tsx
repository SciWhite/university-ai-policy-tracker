import BasePage, { generateMetadata as baseGenerateMetadata } from "../../../(default)/analysis/[slug]/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export function generateStaticParams() {
  return [];
}
export const dynamic = "force-static";
export const dynamicParams = true;
export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  (params) => `/analysis/${params.slug}`
);
export default createLocalizedSurfacePage(BasePage, "/analysis/[slug]");
