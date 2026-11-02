import BasePage, { generateMetadata as baseGenerateMetadata, generateStaticParams as baseGenerateStaticParams } from "../../../../(default)/changes/[releaseId]/[slug]/page";
import { createLocalizedSurfaceMetadata, createLocalizedSurfacePage } from "@/lib/surface-localization";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n";

export async function generateStaticParams({ params }: { params: { locale: string } }) {
  const locale = params.locale;
  if (locale === "en" || !SUPPORTED_LOCALES.includes(locale as SupportedLocale)) return [];
  return baseGenerateStaticParams();
}
export const dynamic = "force-dynamic";
export const dynamicParams = true;
export const revalidate = false;
export const generateMetadata = createLocalizedSurfaceMetadata(
  baseGenerateMetadata as (props: unknown) => ReturnType<typeof baseGenerateMetadata>,
  (params) => `/changes/${params.releaseId}/${params.slug}`
);
export default createLocalizedSurfacePage(BasePage);
