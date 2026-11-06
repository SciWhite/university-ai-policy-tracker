import BasePage, { generateMetadata as baseGenerateMetadata } from "../../../../(default)/changes/[releaseId]/[slug]/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export async function generateStaticParams({ params }: { params: { locale: string } }) {
  return [];
}
// Rendered on first request from the active content release and cached until a content
// switch invalidates its tags, like /changes/[releaseId]. Nothing here reads request data.
export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = false;
export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  (params) => `/changes/${params.releaseId}/${params.slug}`
);
export default createLocalizedSurfacePage(BasePage, "/changes/[releaseId]/[slug]");
