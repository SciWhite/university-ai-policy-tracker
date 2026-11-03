import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/widgets/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/widgets"
);
export default createLocalizedSurfacePage(BasePage, "/widgets");
