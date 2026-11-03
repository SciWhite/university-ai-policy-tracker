import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/about/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/about"
);
export default createLocalizedSurfacePage(BasePage, "/about");
