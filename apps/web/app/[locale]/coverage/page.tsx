import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/coverage/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/coverage"
);
export default createLocalizedSurfacePage(BasePage);
