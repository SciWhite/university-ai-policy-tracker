import BasePage, { metadata as baseMetadata } from "../../(default)/tools/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export const generateMetadata = createLocalizedSurfaceMetadata(baseMetadata, "/tools");
export default createLocalizedSurfacePage(BasePage);
