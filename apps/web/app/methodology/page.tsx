import Link from "next/link";
import { NO_ADVICE_BOUNDARY } from "@uapt/shared";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "Methodology | University AI Policy Tracker";
const description =
  "How University AI Policy Tracker discovers sources, snapshots pages, binds evidence, separates confidence from review state, and publishes citation-ready records.";

const reviewStates = [
  {
    label: "machine_candidate",
    description:
      "A crawler, extractor, or seed process produced the record. It is visible only with candidate labeling and must not be treated as a final policy conclusion."
  },
  {
    label: "needs_review",
    description:
      "The source, extraction, date, or classification needs another review pass before the claim can be used as a trusted public summary."
  },
  {
    label: "agent_reviewed",
    description:
      "A reviewing agent checked the evidence and classification, but the record is still distinct from a human-reviewed or institution-verified claim."
  },
  {
    label: "human_reviewed",
    description:
      "A human reviewer or deterministic publish rule has approved the claim for public reference, while the linked source remains the authority."
  },
  {
    label: "institution_verified",
    description:
      "A future verification label reserved for official institution correction or confirmation workflows. It will not replace source URLs, source hashes, or original-language evidence."
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
      <section className="hero">
        <p className="kicker">Methodology</p>
        <h1>How records become source-backed claims</h1>
        <p className="lead">
          The tracker is built around official sources, source snapshots, short
          evidence snippets in the original source language, machine confidence,
          and explicit review state. It is a public reference database, not legal
          advice or academic integrity advice.
        </p>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Evidence workflow</h2>
          <p>From public source discovery to citation-ready records</p>
        </div>
        <div className="detail-grid">
          <article className="policy-card">
            <h3>Source discovery</h3>
            <p>
              Candidate sources start as public university policy pages, teaching
              center guidance, IT/security guidance, procurement pages, PDFs, and
              other clearly labeled official or source-attributed materials.
            </p>
          </article>
          <article className="policy-card">
            <h3>Snapshots</h3>
            <p>
              Fetching uses plain HTTP first. When a source is captured, normalized
              text receives a content hash so future checks can detect whether a
              source changed.
            </p>
          </article>
          <article className="policy-card">
            <h3>Claim extraction</h3>
            <p>
              A policy claim is one assertion about a university, tool, theme, or
              future course entity. Claims keep confidence separate from review
              state so machine certainty is not confused with approval.
            </p>
          </article>
          <article className="policy-card">
            <h3>Evidence binding</h3>
            <p>
              Every public claim must trace to a source URL, source snapshot hash,
              short evidence snippet, source language, and rights caveat. Original
              source evidence is preserved in its source language.
            </p>
          </article>
          <article className="policy-card">
            <h3>Change detection</h3>
            <p>
              Changed source hashes can create new snapshots, extraction
              candidates, claim updates, and change records. Diff pages are planned
              after the current claim/evidence contract is stable.
            </p>
          </article>
          <article className="policy-card">
            <h3>Limitations</h3>
            <p>
              University policies can be distributed across departments, courses,
              PDFs, and internal systems. Sparse records remain labeled as early
              coverage until reviewed evidence supports stronger conclusions.
            </p>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Review states</h2>
          <p>Review state is not the same as confidence</p>
        </div>
        <div className="detail-grid">
          {reviewStates.map((state) => (
            <article className="policy-card" key={state.label}>
              <h3>
                <code>{state.label}</code>
              </h3>
              <p>{state.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Publication rules</h2>
          <p>What must exist before a claim is public</p>
        </div>
        <ul className="compact-list">
          <li>Every public claim needs a source URL and source snapshot hash.</li>
          <li>Evidence snippets stay short, necessary, and source-attributed.</li>
          <li>Original-language evidence is canonical; translation is display-only.</li>
          <li>Canonical facts and localized display must remain separate.</li>
          <li>Candidate claims must be labeled and must not be used as final summaries.</li>
          <li>Official source documents retain their original rights and terms.</li>
        </ul>
      </section>

      <section className="section">
        <p className="notice-card">{NO_ADVICE_BOUNDARY}</p>
        <p>
          Use the <Link href="/citation">citation guide</Link> for attribution
          rules, the <Link href="/datasets">datasets page</Link> for public JSON
          access, and <Link href="/changes">recent changes</Link> for freshness
          signals.
        </p>
      </section>
    </main>
  );
}
