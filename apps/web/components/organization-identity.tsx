import { getProjectCopy } from "@/lib/project-copy";
import type { SupportedLocale } from "@/lib/i18n";
import { organizationIdentity } from "@/lib/organization-identity";
import { JsonLd } from "./json-ld";
import { ReferenceBox } from "./reference-box";
export function OrganizationIdentity({locale}: {locale: SupportedLocale}) {
  const copy = getProjectCopy(locale);
  return <ReferenceBox id="organization" title={copy.organizationTitle}>
    <JsonLd data={{"@context":"https://schema.org", ...organizationIdentity}} />
    <p>{copy.operator}</p><p>{copy.organizationDetails}</p>
    <p><a href="mailto:support@eduaipolicy.org">support@eduaipolicy.org</a> · <a href="https://www.linkedin.com/in/jiaxiang-s-021155378/">Sam Song · LinkedIn</a></p>
  </ReferenceBox>;
}
