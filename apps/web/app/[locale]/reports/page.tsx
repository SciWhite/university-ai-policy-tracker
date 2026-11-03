import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/reports/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/reports"
);
export default createLocalizedSurfacePage(BasePage, "/reports");
