import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/datasets/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/datasets"
);
export default createLocalizedSurfacePage(BasePage, "/datasets");
