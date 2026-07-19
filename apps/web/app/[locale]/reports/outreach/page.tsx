import BasePage, { generateMetadata as baseGenerateMetadata } from "../../../(default)/reports/outreach/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/reports/outreach"
);
export default createLocalizedSurfacePage(BasePage);
