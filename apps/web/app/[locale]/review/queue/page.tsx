import BasePage, { generateMetadata as baseGenerateMetadata } from "../../../(default)/review/queue/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization-server";

export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  "/review/queue"
);
export default createLocalizedSurfacePage(BasePage, "/review/queue");
