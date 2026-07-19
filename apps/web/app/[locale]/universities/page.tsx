import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/universities/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export const dynamic = "force-static";
export const revalidate = false;
export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/universities"
);
export default createLocalizedSurfacePage(BasePage);
