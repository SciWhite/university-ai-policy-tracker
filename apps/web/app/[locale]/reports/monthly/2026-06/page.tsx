import BasePage, { generateMetadata as baseGenerateMetadata } from "../../../../(default)/reports/monthly/2026-06/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/reports/monthly/2026-06"
);
export default createLocalizedSurfacePage(BasePage);
