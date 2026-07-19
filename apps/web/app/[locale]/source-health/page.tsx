import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/source-health/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/source-health"
);
export default createLocalizedSurfacePage(BasePage);
