import Link from "next/link";
import { NO_ADVICE_BOUNDARY } from "@uapt/shared";
import { JsonLd } from "@/components/json-ld";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "Methodology | University AI Policy Tracker";
const description =
  "How University AI Policy Tracker discovers sources, snapshots pages, binds evidence, separates confidence from review state, and publishes citation-ready records.";

const workflowSteps = [
  {
    id: "source-discovery",
    title: "Source discovery",
    description:
      "Public university policy pages, teaching guidance, IT/security pages, procurement pages, PDFs, and source-attributed materials."
  },
  {
    id: "crawl-snapshot",
    title: "Crawl and snapshot",
    description:
      "Fetched source text receives a content hash for future change checks."
  },
  {
    id: "claim-extraction",
    title: "Claim extraction",
    description:
      "Claims keep confidence separate from review state."
  },
  {
    id: "evidence-binding",
    title: "Evidence binding",
    description:
      "Every public claim needs a source URL, snapshot hash, evidence snippet, source language, and rights caveat."
  },
  {
    id: "change-detection",
    title: "Change detection",
    description:
      "Changed hashes can create new snapshots, candidates, claim updates, and change records."
  },
  {
    id: "multilingual-evidence",
    title: "Multilingual source-first evidence",
    description:
      "Original-language evidence is canonical; translations are display helpers."
  }
] as const;

const reviewStates = [
  {
    label: "machine_candidate",
    description:
      "Produced by crawler, extractor, or seed process; not final."
  },
  {
    label: "needs_review",
    description:
      "Source, extraction, date, or classification needs review."
  },
  {
    label: "agent_reviewed",
    description:
      "Agent checked evidence and classification."
  },
  {
    label: "human_reviewed",
    description:
      "Human reviewer or deterministic publish rule approved the claim."
  },
  {
    label: "rejected",
    description:
      "Retained only for audit context."
  }
] as const;

const methodologyAnswers = [
  {
    title: "How records become public",
    text:
      "Records become public after source discovery, snapshot hashing, claim extraction, evidence binding, review-state labeling, and publication from the promoted public dataset."
  },
  {
    title: "What review state means",
    text:
      "Review state describes workflow status. Confidence is a separate machine-assessed support score and does not make a claim official."
  },
  {
    title: "What evidence is canonical",
    text:
      "Original-language evidence, source URLs, and official university pages remain canonical; translations or summaries are helper metadata."
  }
] as const;

export function generateMetadata() {
  const canonical = getAbsoluteSiteUrl("/methodology");

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website"
    }
  };
}

export default function MethodologyPage() {
  return (
    <main className="page-shell">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: methodologyAnswers.map((answer) => ({
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
        <p className="kicker">Methodology</p>
        <h1>How records become source-backed claims</h1>
        <p className="lead">
          Official sources, snapshots, short evidence snippets, confidence, and
          explicit review state.
        </p>
      </section>

      <section className="answer-strip" aria-label="Methodology answer blocks">
        {methodologyAnswers.map((answer) => (
          <article className="answer-card" key={answer.title}>
            <h2>{answer.title}</h2>
            <p>{answer.text}</p>
          </article>
        ))}
      </section>

      <div className="docs-layout">
        <aside className="docs-toc" aria-label="Methodology sections">
          <a href="#workflow">Evidence workflow</a>
          <a href="#review-states">Review states</a>
          <a href="#ranking-boundaries">Ranking boundaries</a>
          <a href="#publication-rules">Publication rules</a>
          <a href="#limitations">Limitations</a>
        </aside>

        <div className="docs-content">
          <ReferenceBox
            description="From public source discovery to citation-ready records."
            id="workflow"
            title="Evidence workflow"
          >
            <ol className="timeline-list">
              {workflowSteps.map((step) => (
                <li className="timeline-list__item" key={step.id}>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </ReferenceBox>

          <ReferenceBox
            description="Review state is workflow status. Confidence is machine-assessed support."
            id="review-states"
            title="Review states"
          >
            <div className="docs-grid">
              {reviewStates.map((state) => (
                <section key={state.label}>
                  <StateLabel prefix="" reviewState={state.label} />
                  <p>{state.description}</p>
                </section>
              ))}
            </div>
          </ReferenceBox>

          <ReferenceBox
            description="Ranking rows help prioritize and filter source discovery. They are not policy claims."
            id="ranking-boundaries"
            title="Ranking and index boundaries"
          >
            <ul className="compact-list">
              <li>
                QS 2026 currently remains the main crawl batching source for
                expanding public coverage.
              </li>
              <li>
                THE 2026, ARWU 2025, U.S. News 2025-2026, and CWTS Leiden 2025
                are supported as ranking, index, and filter sources.
              </li>
              <li>
                CWTS Leiden 2025 is a derived metric order, not an overall
                global university rank.
              </li>
              <li>
                Different ranking years are not presented as one unified 2026
                ranking.
              </li>
              <li>
                Ranking data does not create or override policy claims; visible
                claims still require official sources, evidence snippets,
                confidence, and review state.
              </li>
            </ul>
          </ReferenceBox>

          <ReferenceBox
            description="What must exist before a claim is public."
            id="publication-rules"
            title="Publication rules"
          >
            <ul className="compact-list">
              <li>Every public claim needs a source URL and source snapshot hash.</li>
              <li>Evidence snippets stay short, necessary, and source-attributed.</li>
              <li>Original-language evidence is canonical; translation is display-only.</li>
              <li>Canonical facts and localized display must remain separate.</li>
              <li>Candidate claims must be labeled and must not be used as final summaries.</li>
              <li>
                Public pages and <code>/api/public/v1</code> JSON should be
                generated from the same promoted public release dataset.
              </li>
              <li>Official source documents retain their original rights and terms.</li>
            </ul>
          </ReferenceBox>

          <ReferenceBox
            description="Known boundaries of the current evidence layer."
            id="limitations"
            title="Limitations"
          >
            <ul className="compact-list">
              <li>
                University policies can be distributed across departments,
                courses, PDFs, and internal systems.
              </li>
              <li>
                Sparse records remain labeled as early coverage until reviewed
                evidence supports stronger conclusions.
              </li>
              <li>
                The tracker records source-check and claim-evidence metadata; it
                does not provide legal advice or academic integrity advice.
              </li>
            </ul>
            <p className="notice-card">{NO_ADVICE_BOUNDARY}</p>
          </ReferenceBox>

          <section className="section">
            <p>
              Use the <Link href="/citation">citation guide</Link> for attribution
              rules, the <Link href="/datasets">datasets page</Link> for public
              JSON access, and <Link href="/changes">recent changes</Link> for
              freshness signals.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
