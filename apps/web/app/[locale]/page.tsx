import BasePage, { generateMetadata as baseGenerateMetadata } from "../(default)/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

// Locales render on first request and are then served from the ISR cache until
// a content switch expires the `home` tag (docs/render-once.md).
export const dynamicParams = true;
export const revalidate = false;
export function generateStaticParams(): Array<{ locale: string }> {
  return [];
}

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/"
);
export default createLocalizedSurfacePage(BasePage, "/");
