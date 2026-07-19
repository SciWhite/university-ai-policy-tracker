import Link from "next/link";
import type { Metadata } from "next";
import { getCatalogSources } from "@/lib/catalog";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";

const alternates = getLocalizedAlternates("/sources", "en");

export const metadata: Metadata = {
  title: "Sources | University AI Policy Tracker",
  description:
    "Official source pages and documents behind the public university AI policy records.",
  alternates,
  openGraph: {
    title: "Sources | University AI Policy Tracker",
    description:
      "Official source pages and documents behind the public university AI policy records.",
    url: String(alternates.canonical),
    type: "website"
  }
};

export default async function SourcesPage() {
  const sources = await getCatalogSources();

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="kicker">Catalog read path</p>
        <h1>Sources</h1>
        <p className="lead">
          Minimal source index for policy pages and documents. Full source
          snapshots and diffs will build on this catalog read path.
        </p>
      </section>

      <section className="section">
        <div className="card-grid">
          {sources.map((source) => (
            <article className="policy-card" key={`${source.universitySlug}:${source.url}`}>
              <div>
                <h2 data-i18n="preserve">{source.title}</h2>
                <p>
                  <Link href={`/universities/${source.universitySlug}`}>
                    {source.universityName}
                  </Link>
                </p>
              </div>
              <div className="tag-row">
                <span className="pill">{source.documentStatus}</span>
                <span className="pill">{source.serviceTreatment}</span>
                <span className="pill">{source.reviewState}</span>
              </div>
              <ul className="source-list">
                <li>
                  <a href={source.url}>{source.url}</a>
                </li>
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
