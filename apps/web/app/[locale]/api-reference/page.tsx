import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/api-reference/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/api-reference"
);
export default createLocalizedSurfacePage(BasePage, "/api-reference");
