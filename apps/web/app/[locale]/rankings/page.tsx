import BasePage, { generateMetadata as baseGenerateMetadata } from "../../(default)/rankings/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/rankings"
);
export default createLocalizedSurfacePage(BasePage, "/rankings");
export const dynamic = "force-dynamic";
export const revalidate = false;
