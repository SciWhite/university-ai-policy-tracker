import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/search/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/search"
);
export default createLocalizedSurfacePage(BasePage);
