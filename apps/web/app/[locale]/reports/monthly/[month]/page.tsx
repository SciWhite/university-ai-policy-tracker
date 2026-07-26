import BasePage, { generateMetadata as baseGenerateMetadata, generateStaticParams } from "../../../../(default)/reports/monthly/[month]/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";

export { generateStaticParams };
export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = false;
export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  (params) => `/reports/monthly/${params.month}`
);
export default createLocalizedSurfacePage(BasePage);
