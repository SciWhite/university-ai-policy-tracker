import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/university-ai-policy-database/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/university-ai-policy-database"
);
export default createLocalizedSurfacePage(BasePage, "/university-ai-policy-database");
