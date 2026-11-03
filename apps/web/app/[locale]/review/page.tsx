import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/review/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/review"
);
export default createLocalizedSurfacePage(BasePage, "/review");
