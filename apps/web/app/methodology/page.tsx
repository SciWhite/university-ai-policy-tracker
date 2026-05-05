import Link from "next/link";

export const metadata = {
  title: "Methodology | University AI Policy Tracker",
  description:
    "How University AI Policy Tracker discovers sources, binds evidence, separates confidence from review state, and publishes citation-ready records."
};

export default function MethodologyPage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="kicker">Methodology</p>
        <h1>How records become source-backed claims</h1>
        <p className="lead">
          The tracker is built around official sources, source snapshots, short
          original-language evidence snippets, machine confidence, and explicit
          review state. It is not legal advice or academic integrity advice.
        </p>
      </section>

      <section className="section">
        <div className="detail-grid">
          <article className="policy-card">
            <h2>Source discovery</h2>
            <p>
              Candidate sources start as public university pages, guidance pages,
              PDFs, teaching center pages, IT/security pages, and related official
              materials. Sources are labeled before their claims are treated as
              public facts.
            </p>
          </article>
          <article className="policy-card">
            <h2>Crawling</h2>
            <p>
              Fetching uses plain HTTP first, respects access boundaries, and
              records crawl status. Dynamic tools are reserved for cases where a
              static fetch is insufficient.
            </p>
          </article>
          <article className="policy-card">
            <h2>Change detection</h2>
            <p>
              Normalized source text receives a content hash. Changed hashes can
              create snapshots, diffs, extraction candidates, and claim evidence.
            </p>
          </article>
          <article className="policy-card">
            <h2>Review workflow</h2>
            <p>
              Confidence is machine confidence in extraction or classification.
              Review state is separate and records whether a claim is a machine
              candidate, agent reviewed, human reviewed, needs review, or rejected.
            </p>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Publication rules</h2>
          <p>What must exist before a claim is public</p>
        </div>
        <ul className="compact-list">
          <li>Every public claim needs a source URL and source snapshot hash.</li>
          <li>Evidence snippets stay short and source-attributed.</li>
          <li>Original-language evidence is canonical; translation is display-only.</li>
          <li>Canonical facts and localized display must remain separate.</li>
          <li>Candidate claims must be labeled and must not be used as final summaries.</li>
        </ul>
      </section>

      <section className="section">
        <p className="notice-card">
          This site is a reference database. It does not tell students what they
          may do in a course, and it does not provide legal interpretation. Users
          should read the linked official sources and their institution, course,
          and instructor rules.
        </p>
        <p>
          See also <Link href="/citation">citation rules</Link> and{" "}
          <Link href="/datasets">dataset access</Link>.
        </p>
      </section>
    </main>
  );
}
