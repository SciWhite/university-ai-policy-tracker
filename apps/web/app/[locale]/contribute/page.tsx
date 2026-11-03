import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/contribute/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/contribute"
);
export default createLocalizedSurfacePage(BasePage, "/contribute");
