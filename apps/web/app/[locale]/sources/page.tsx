import BasePage, {
  generateMetadata as baseGenerateMetadata,
  parsePageNumber,
  getSourcesPagePath
} from "../../(default)/sources/page";
import {
  createLocalizedSurfaceMetadata,
  createLocalizedSurfacePage
} from "@/lib/surface-localization-server";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  (_params, searchParams) => {
    const page = parsePageNumber(searchParams?.page);
    return getSourcesPagePath(page);
  }
);
export default createLocalizedSurfacePage(BasePage, "/sources");
