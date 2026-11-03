import BasePage, { generateMetadata as baseGenerateMetadata } from "../../../(default)/rankings/[slug]/page";
import {
  createLocalizedSurfaceMetadata,
  createLocalizedSurfacePage,
} from "@/lib/surface-localization-server";

export function generateStaticParams() {
  return [];
}
export const dynamic = "force-dynamic";
export const dynamicParams = true;
export const revalidate = false;
export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (
    props: unknown,
  ) => ReturnType<typeof baseGenerateMetadata>,
  (params) => `/rankings/${params.slug}`,
);
export default createLocalizedSurfacePage(BasePage, "/rankings/[slug]");
