import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/contribute/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/contribute"
);
export default createLocalizedSurfacePage(BasePage);
