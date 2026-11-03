import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/coverage/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/coverage"
);
export default createLocalizedSurfacePage(BasePage, "/coverage");
