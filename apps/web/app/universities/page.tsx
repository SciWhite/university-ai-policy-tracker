import Link from "next/link";
import { getCatalogUniversities } from "@/lib/catalog";
import { MetaLabel } from "@/components/meta-label";
import { StateLabel } from "@/components/state-label";

export const metadata = {
  title: "Universities | University AI Policy Tracker"
};

export default async function UniversitiesPage() {
  const universities = (await getCatalogUniversities()).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
  const sourceCount = universities.reduce(
    (total, university) => total + (university.sourceCount ?? university.sources.length),
    0
  );
  const checkedCount = universities.filter((university) =>
    university.sources.some((source) => source.lastCheckedAt)
  ).length;

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="kicker">Evidence records</p>
        <h1>Universities</h1>
        <p className="lead">
          Browse source-backed university AI policy records promoted from
          validated staged artifacts into versioned public pages and JSON.
        </p>
      </section>

      <section className="metrics-grid" aria-label="University coverage">
        <div>
          <span>{universities.length}</span>
          <p>university records</p>
        </div>
        <div>
          <span>{sourceCount}</span>
          <p>official source attributions</p>
        </div>
        <div>
          <span>{checkedCount}</span>
          <p>records with checked dates</p>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Repository-style index</h2>
          <p>{universities.length} public record</p>
        </div>
        <div className="record-list">
          {universities.map((university) => (
            <article className="record-list-row" key={university.slug}>
              <div className="record-list-row__main">
                <h2>{university.name}</h2>
                <p>
                  {university.summary}
                </p>
              </div>
              <div className="record-list-row__meta">
                <MetaLabel label="Location">
                  {university.region}, {university.country}
                </MetaLabel>
                <MetaLabel label="Sources">
                  {university.sourceCount ?? university.sources.length}
                </MetaLabel>
                {university.sources[0]?.reviewState ? (
                  <StateLabel reviewState={university.sources[0].reviewState} />
                ) : null}
              </div>
              <Link href={`/universities/${university.slug}`}>Open record</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
