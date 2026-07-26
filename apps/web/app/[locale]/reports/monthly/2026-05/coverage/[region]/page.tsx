import BasePage, { generateMetadata as baseGenerateMetadata, generateStaticParams } from "../../../../../../(default)/reports/monthly/2026-05/coverage/[region]/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export { generateStaticParams };
export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;
export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  (params) => `/reports/monthly/2026-05/coverage/${params.region}`
);
export default createLocalizedSurfacePage(BasePage);
