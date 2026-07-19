import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/changes/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export const dynamic = "force-dynamic";
export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/changes"
);
export default createLocalizedSurfacePage(BasePage);
