import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/citation/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/citation"
);
export default createLocalizedSurfacePage(BasePage, "/citation");
