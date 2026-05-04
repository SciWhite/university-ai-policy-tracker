import Link from "next/link";
import { seedUniversities } from "@uapt/shared";

export const metadata = {
  title: "Universities | University AI Policy Tracker"
};

export default function UniversitiesPage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="kicker">Seed index</p>
        <h1>Universities</h1>
        <p className="lead">
          Initial placeholders for public university policy pages. These records
          are seed data only until source snapshots and review decisions are wired.
        </p>
      </section>

      <section className="section">
        <div className="card-grid">
          {seedUniversities.map((university) => (
            <article className="policy-card" key={university.slug}>
              <div>
                <h2>{university.name}</h2>
                <p>
                  {university.region}, {university.country}
                </p>
              </div>
              <p>{university.summary}</p>
              <div className="policy-meta">
                <span className="pill">{university.sources.length} seed source</span>
                <span className="pill">{university.sources[0]?.reviewState}</span>
              </div>
              <Link href={`/universities/${university.slug}`}>View placeholder</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
