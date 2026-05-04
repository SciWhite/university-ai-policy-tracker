import Link from "next/link";
import { getCatalogUniversities } from "@/lib/catalog";

export const metadata = {
  title: "Universities | University AI Policy Tracker"
};

export default async function UniversitiesPage() {
  const universities = await getCatalogUniversities();

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="kicker">Seed index</p>
        <h1>Universities</h1>
        <p className="lead">
          Public university policy pages backed by the catalog API when it is
          configured, with shared seed data as the local build fallback.
        </p>
      </section>

      <section className="section">
        <div className="card-grid">
          {universities.map((university) => (
            <article className="policy-card" key={university.slug}>
              <div>
                <h2>{university.name}</h2>
                <p>
                  {university.region}, {university.country}
                </p>
              </div>
              <p>{university.summary}</p>
              <div className="policy-meta">
                <span className="pill">{university.sourceCount ?? university.sources.length} source</span>
                <span className="pill">{university.sources[0]?.reviewState}</span>
              </div>
              <Link href={`/universities/${university.slug}`}>View catalog page</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
