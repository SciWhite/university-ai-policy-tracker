import { ReferenceBox } from "@/components/reference-box";
import { getProjectCopy } from "@/lib/project-copy";
import type { SupportedLocale } from "@/lib/i18n";
import type { ReadingLocale } from "@/lib/language-catalog";
import { localizeSurfaceCopy } from "@/lib/surface-localization";

export function AgentMethods({ locale, readingLocale = locale, sharedUiText = {} }: { locale: SupportedLocale; readingLocale?: ReadingLocale; sharedUiText?: Readonly<Record<string, string>> }) {
  const copy = localizeSurfaceCopy(getProjectCopy(locale), readingLocale, sharedUiText);
  return (
    <ReferenceBox id="agents" title={copy.agentsTitle}>
      <p>{copy.agents}</p>
      <p>{copy.tools}</p>
      <h3>{copy.historyTitle}</h3>
      <ul className="compact-list">
        <li><a href="https://github.com/SciWhite/university-ai-policy-tracker/commit/1e785be">{copy.sourceHistory}</a></li>
        <li><a href="https://github.com/SciWhite/university-ai-policy-tracker/commit/e27c42c">{copy.auditHistory}</a></li>
      </ul>
    </ReferenceBox>
  );
}
