import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/methodology/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/methodology"
);
export default createLocalizedSurfacePage(BasePage, "/methodology");
