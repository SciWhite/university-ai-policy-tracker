import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/changes/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export const dynamic = "force-static";
export const revalidate = false;
export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/changes"
);
export default createLocalizedSurfacePage(BasePage);
