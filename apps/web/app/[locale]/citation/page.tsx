import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/citation/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/citation"
);
export default createLocalizedSurfacePage(BasePage);
