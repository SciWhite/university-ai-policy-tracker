import BasePage, { metadata as baseMetadata } from "../../(default)/sources/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export const generateMetadata = createLocalizedSurfaceMetadata(baseMetadata, "/sources");
export default createLocalizedSurfacePage(BasePage, "/sources");
