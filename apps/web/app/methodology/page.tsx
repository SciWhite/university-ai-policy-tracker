import { DocumentLink as Link } from "@/components/document-link";
import { NO_ADVICE_BOUNDARY } from "@uapt/shared";
import { JsonLd } from "@/components/json-ld";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { normalizeLocale } from "@/lib/i18n";
import { getPageCopy } from "@/lib/page-copy";

interface MethodologyPageProps {
  params?: Promise<{
    locale?: string;
  }>;
}

export async function generateMetadata({
  params
}: MethodologyPageProps = {}) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).methodology;
  const alternates = getLocalizedAlternates("/methodology", locale);
  const canonical = String(alternates.canonical);

  return {
    title: copy.title,
    description: copy.description,
    alternates,
    openGraph: {
      title: copy.title,
      description: copy.description,
      url: canonical,
      type: "website"
    }
  };
}

export default async function MethodologyPage({ params }: MethodologyPageProps) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).methodology;

  return (
    <main className="page-shell">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: copy.answers.map((answer) => ({
            "@type": "Question",
            name: answer.title,
            acceptedAnswer: {
              "@type": "Answer",
              text: answer.text
            }
          }))
        }}
      />
      <section className="hero">
        <p className="kicker">{copy.kicker}</p>
        <h1>{copy.heading}</h1>
        <p className="lead">{copy.lead}</p>
      </section>

      <section className="answer-strip" aria-label={copy.answersLabel}>
        {copy.answers.map((answer) => (
          <article className="answer-card" key={answer.title}>
            <h2>{answer.title}</h2>
            <p>{answer.text}</p>
          </article>
        ))}
      </section>

      <div className="docs-layout">
        <aside className="docs-toc" aria-label={copy.tocLabel}>
          <a href="#workflow">{copy.toc.workflow}</a>
          <a href="#review-states">{copy.toc.reviewStates}</a>
          <a href="#ranking-boundaries">{copy.toc.rankingBoundaries}</a>
          <a href="#publication-rules">{copy.toc.publicationRules}</a>
          <a href="#limitations">{copy.toc.limitations}</a>
        </aside>

        <div className="docs-content">
          <ReferenceBox
            description={copy.workflowDescription}
            id="workflow"
            title={copy.toc.workflow}
          >
            <ol className="timeline-list">
              {copy.workflowSteps.map((step) => (
                <li className="timeline-list__item" key={step.title}>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </ReferenceBox>

          <ReferenceBox
            description={copy.reviewDescription}
            id="review-states"
            title={copy.toc.reviewStates}
          >
            <div className="docs-grid">
              {copy.reviewStates.map((state) => (
                <section key={state.label}>
                  <StateLabel prefix="" reviewState={state.label} />
                  <p>{state.description}</p>
                </section>
              ))}
            </div>
          </ReferenceBox>

          <ReferenceBox
            description={copy.rankingDescription}
            id="ranking-boundaries"
            title={copy.toc.rankingBoundaries}
          >
            <ul className="compact-list">
              {copy.rankingRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </ReferenceBox>

          <ReferenceBox
            description={copy.publicationDescription}
            id="publication-rules"
            title={copy.toc.publicationRules}
          >
            <ul className="compact-list">
              {copy.publicationRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </ReferenceBox>

          <ReferenceBox
            description={copy.limitationsDescription}
            id="limitations"
            title={copy.toc.limitations}
          >
            <ul className="compact-list">
              {copy.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
            <p className="notice-card">{NO_ADVICE_BOUNDARY}</p>
          </ReferenceBox>

          <section className="section">
            <p>
              {copy.footer}{" "}
              <Link href="/citation">{copy.links.citationGuide}</Link>{" "}
              <Link href="/datasets">{copy.links.datasetsPage}</Link>{" "}
              <Link href="/changes">{copy.links.recentChanges}</Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
