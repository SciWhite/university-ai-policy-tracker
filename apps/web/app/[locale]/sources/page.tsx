import BasePage, { metadata as baseMetadata } from "../../(default)/sources/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export const generateMetadata = createLocalizedSurfaceMetadata(baseMetadata, "/sources");
export default createLocalizedSurfacePage(BasePage);
