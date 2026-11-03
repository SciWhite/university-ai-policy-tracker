import BasePage, { generateMetadata as baseGenerateMetadata } from "../../../(default)/coverage/qs-2026/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/coverage/qs-2026"
);
export default createLocalizedSurfacePage(BasePage, "/coverage/qs-2026");
