import BasePage, { generateMetadata as baseGenerateMetadata } from "../(default)/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/"
);
export default createLocalizedSurfacePage(BasePage);
