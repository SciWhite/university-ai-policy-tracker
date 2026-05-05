import Link from "next/link";
import {
  NO_ADVICE_BOUNDARY,
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  TRACKER_METADATA_LICENSE
} from "@uapt/shared";

export const metadata = {
  title: "Citation | University AI Policy Tracker",
  description:
    "Citation formats, source attribution rules, rights caveats, and advice boundaries for University AI Policy Tracker."
};

export default function CitationPage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="kicker">Citation</p>
        <h1>Cite tracker metadata and official sources separately</h1>
        <p className="lead">
          Public records are designed for citation, but tracker metadata does not
          relicense official university documents or replace official policy text.
        </p>
      </section>

      <section className="section">
        <div className="detail-grid">
          <article className="policy-card">
            <h2>Entity citation</h2>
            <p>
              University AI Policy Tracker. "University name AI Policy Tracker
              record." Last checked YYYY-MM-DD. Canonical page URL and versioned
              public JSON URL.
            </p>
          </article>
          <article className="policy-card">
            <h2>Claim citation</h2>
            <p>
              Preserve the claim text, review state, confidence, source URL,
              source snapshot hash, and short original evidence snippet from the
              public JSON record.
            </p>
          </article>
          <article className="policy-card">
            <h2>Dataset citation</h2>
            <p>
              Dataset release citations will cite tracker metadata and release
              identifiers when monthly exports begin.
            </p>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Rights and boundaries</h2>
          <p>{TRACKER_METADATA_LICENSE} tracker metadata</p>
        </div>
        <ul className="compact-list">
          <li>{OFFICIAL_SOURCE_RIGHTS_CAVEAT}</li>
          <li>{NO_ADVICE_BOUNDARY}</li>
          <li>
            Original-language evidence is canonical. Translations or localized
            summaries are display aids only.
          </li>
        </ul>
      </section>

      <section className="section">
        <p>
          Browse <Link href="/universities">university records</Link> or read the{" "}
          <Link href="/methodology">methodology</Link>.
        </p>
      </section>
    </main>
  );
}
