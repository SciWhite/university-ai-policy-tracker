import { getProjectCopy } from "@/lib/project-copy";
import type { SupportedLocale } from "@/lib/i18n";
import { organizationIdentity } from "@/lib/organization-identity";
import { JsonLd } from "./json-ld";
import { ReferenceBox } from "./reference-box";
import type { ReadingLocale } from "@/lib/language-catalog";
import { localizeSurfaceCopy } from "@/lib/surface-localization";
export function OrganizationIdentity({locale, readingLocale = locale, sharedUiText = {}}: {locale: SupportedLocale; readingLocale?: ReadingLocale; sharedUiText?: Readonly<Record<string, string>>}) {
  const copy = localizeSurfaceCopy(getProjectCopy(locale), readingLocale, sharedUiText);
  return <ReferenceBox id="organization" title={copy.organizationTitle}>
    <JsonLd data={{"@context":"https://schema.org", ...organizationIdentity}} />
    <p>{copy.operator}</p><p>{copy.organizationDetails}</p>
    <p><a href="mailto:support@eduaipolicy.org">support@eduaipolicy.org</a> · <a href="https://www.linkedin.com/in/jiaxiang-s-021155378/">Sam Song · LinkedIn</a></p>
  </ReferenceBox>;
}
