import { DEFAULT_LOCALE, type SupportedLocale } from "@/lib/i18n";
import { translateSurfaceText } from "@/lib/surface-localization";

interface ReferenceTab {
  href: `#${string}`;
  label: string;
}

interface ReferenceTabsProps {
  locale?: SupportedLocale;
  tabs: readonly ReferenceTab[];
}

export function ReferenceTabs({ locale = DEFAULT_LOCALE, tabs }: ReferenceTabsProps) {
  return (
    <nav
      aria-label={translateSurfaceText("Record sections", locale)}
      className="reference-tabs"
    >
      {tabs.map((tab) => (
        <a href={tab.href} key={tab.href}>
          {tab.label}
        </a>
      ))}
    </nav>
  );
}
