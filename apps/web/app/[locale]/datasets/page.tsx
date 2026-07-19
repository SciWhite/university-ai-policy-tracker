import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/datasets/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/datasets"
);
export default createLocalizedSurfacePage(BasePage);
