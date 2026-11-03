import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/analysis/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/analysis"
);
export default createLocalizedSurfacePage(BasePage, "/analysis");
