import BasePage, { generateMetadata as baseGenerateMetadata } from "../(default)/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

// Locales render on first request and are then served from the ISR cache.
export const dynamicParams = true;
export const revalidate = 3600;
export function generateStaticParams(): Array<{ locale: string }> {
  return [];
}

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/"
);
export default createLocalizedSurfacePage(BasePage, "/");
