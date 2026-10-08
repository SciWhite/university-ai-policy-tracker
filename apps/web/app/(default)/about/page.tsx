import { OrganizationIdentity } from "@/components/organization-identity";
import { AgentMethods } from "@/components/agent-methods";
import { DocumentLink as Link } from "@/components/document-link";
import { ReferenceBox } from "@/components/reference-box";
import { normalizeLocale } from "@/lib/i18n";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { getProjectCopy } from "@/lib/project-copy";

type Props = { params?: Promise<{ locale?: string }> };

export async function generateMetadata({ params }: Props = {}) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getProjectCopy(locale);
  return {
    title: `${copy.title} | University AI Policy Tracker`,
    description: copy.lead,
    alternates: getLocalizedAlternates("/about", locale)
  };
}

export default async function AboutPage({ params }: Props) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getProjectCopy(locale);
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="kicker">University AI Policy Tracker</p>
        <h1>{copy.title}</h1>
        <p className="lead">{copy.lead}</p>
        <p>{copy.project}</p>
        <p>{copy.purpose}</p>
      </section>
      <div className="docs-content">
        <OrganizationIdentity locale={locale} />
        <AgentMethods locale={locale} />
        <ReferenceBox id="sources-and-review" title={copy.dataTitle}>
          <p>{copy.review}</p>
          <p>{copy.data}</p>
          <Link href="/methodology" localeOverride={locale}>{copy.methodology}</Link>
        </ReferenceBox>
        <ReferenceBox id="contact" title={copy.contact}>
          <a href="mailto:support@eduaipolicy.org">support@eduaipolicy.org</a>
        </ReferenceBox>
      </div>
    </main>
  );
}
