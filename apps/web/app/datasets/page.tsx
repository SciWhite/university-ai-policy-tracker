import Link from "next/link";
import {
  OFFICIAL_SOURCE_RIGHTS_CAVEAT,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE
} from "@uapt/shared";
import { getCatalogUniversities, getRecentChangesJsonUrl } from "@/lib/catalog";

export const metadata = {
  title: "Datasets | University AI Policy Tracker",
  description:
    "Public JSON endpoints, dataset release plan, licensing, rights caveats, and data dictionary notes."
};

export default async function DatasetsPage() {
  const universities = await getCatalogUniversities();
  const universityCount = universities.length;
  const sourceCount = universities.reduce(
    (total, university) => total + university.sources.length,
    0
  );

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="kicker">Datasets</p>
        <h1>Public JSON first, dataset releases next</h1>
        <p className="lead">
          The current dataset surface is the versioned public JSON API. Bulk
          monthly JSONL exports, checksums, and release identifiers will be added
          after the review workflow matures.
        </p>
      </section>

      <section className="metrics-grid" aria-label="Current dataset coverage">
        <div>
          <span>{universityCount}</span>
          <p>seed universities</p>
        </div>
        <div>
          <span>{sourceCount}</span>
          <p>seed policy sources</p>
        </div>
        <div>
          <span>{PUBLIC_API_VERSION}</span>
          <p>public JSON schema version</p>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Versioned JSON endpoints</h2>
          <p>Stable enough for links, additive fields allowed</p>
        </div>
        <ul className="compact-list">
          <li>
            <code>/api/public/{PUBLIC_API_VERSION}/universities/harvard.json</code>
          </li>
          <li>
            <a href={getRecentChangesJsonUrl()}>
              /api/public/{PUBLIC_API_VERSION}/recent-changes.json
            </a>
          </li>
        </ul>
      </section>

      <section className="section">
        <div className="detail-grid">
          <article className="policy-card">
            <h2>License</h2>
            <p>Tracker metadata is planned for {TRACKER_METADATA_LICENSE}.</p>
          </article>
          <article className="policy-card">
            <h2>Source rights</h2>
            <p>{OFFICIAL_SOURCE_RIGHTS_CAVEAT}</p>
          </article>
          <article className="policy-card">
            <h2>Release cadence</h2>
            <p>
              Bulk dataset releases are pending. Current public data should be
              referenced through canonical pages and versioned JSON.
            </p>
          </article>
        </div>
      </section>

      <section className="section">
        <p className="notice-card">
          Dataset records are source-backed reference metadata. They are not legal
          advice, academic integrity advice, or official university statements.
        </p>
        <p>
          Citation rules are documented at <Link href="/citation">/citation</Link>.
        </p>
      </section>
    </main>
  );
}
