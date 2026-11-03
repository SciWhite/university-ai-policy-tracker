import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/search/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/search"
);
export default createLocalizedSurfacePage(BasePage, "/search");
