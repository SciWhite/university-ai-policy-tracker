import { ReferenceTabsNav } from "@/components/reference-tabs-nav";
import { DEFAULT_LOCALE, type SupportedLocale } from "@/lib/i18n";
import { translateSurfaceText } from "@/lib/surface-localization";

interface ReferenceTab {
  href: `#${string}`;
  label: string;
  spy?: boolean;
}

interface ReferenceTabsProps {
  locale?: SupportedLocale;
  tabs: readonly ReferenceTab[];
}

export function ReferenceTabs({ locale = DEFAULT_LOCALE, tabs }: ReferenceTabsProps) {
  return (
    <ReferenceTabsNav
      ariaLabel={translateSurfaceText("Record sections", locale)}
      tabs={tabs}
    />
  );
}
