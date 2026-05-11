import Link from "next/link";
import { getCatalogUniversities } from "@/lib/catalog";

const startLinks = [
  { label: "Browse universities", href: "/universities" },
  { label: "View changes", href: "/changes" },
  { label: "Inspect datasets", href: "/datasets" },
  { label: "Embed widgets", href: "/widgets" },
  { label: "Contribute evidence", href: "/contribute" },
  { label: "Review workflow", href: "/review" },
  { label: "Read API reference", href: "/api-reference" },
  { label: "Review MCP alpha", href: "/mcp" },
  { label: "Cite the tracker", href: "/citation" },
  { label: "Read methodology", href: "/methodology" },
  { label: "Open public API index", href: "/api/public/v1/index.json" }
] as const;

export default async function HomePage() {
  const universities = await getCatalogUniversities();
  const sourceCount = universities.reduce(
    (total, university) => total + university.sources.length,
    0
  );

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="kicker">Open evidence database</p>
        <h1>University AI policy records with source-backed evidence</h1>
        <p className="lead">
          University AI Policy Tracker publishes crawlable, citation-ready
          metadata about university AI policy sources, claims, source snapshots,
          review states, confidence, and public JSON. It is a reference database,
          not legal advice or academic integrity advice.
        </p>
      </section>

      <section className="metrics-grid" aria-label="Public dataset summary">
        <div>
          <span>{universities.length}</span>
          <p>tracked universities</p>
        </div>
        <div>
          <span>{sourceCount}</span>
          <p>policy sources</p>
        </div>
        <div>
          <span>0</span>
          <p>automation hosts connected to production</p>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Start here</h2>
          <p>Server-rendered database surfaces and public JSON for reuse.</p>
        </div>
        <div className="link-grid">
          {startLinks.map((startLink) =>
            startLink.href.startsWith("/api/") ? (
              <a className="text-card" href={startLink.href} key={startLink.href}>
                {startLink.label}
              </a>
            ) : (
              <Link className="text-card" href={startLink.href} key={startLink.href}>
                {startLink.label}
              </Link>
            )
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Trust model</h2>
          <p>Original-language evidence stays canonical.</p>
        </div>
        <div className="detail-grid">
          <article className="policy-card">
            <h3>Evidence layer</h3>
            <p>
              Claims trace to official or clearly labeled source URLs, short
              evidence snippets, source language, and snapshot hashes.
            </p>
          </article>
          <article className="policy-card">
            <h3>Review layer</h3>
            <p>
              Review state and confidence are separate so candidate records do
              not look like final policy conclusions.
            </p>
          </article>
          <article className="policy-card">
            <h3>Contribution layer</h3>
            <p>
              Source URLs, institution corrections, translation fixes, and
              course submissions enter review queues before they can affect
              public claim/evidence records.
            </p>
          </article>
          <article className="policy-card">
            <h3>Distribution layer</h3>
            <p>
              Public pages remain crawlable, and versioned JSON stays available
              for citation, agents, and downstream analysis.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
