import Link from "next/link";
import { notFound } from "next/navigation";
import { findSeedUniversity, seedUniversities } from "@uapt/shared";

interface UniversityPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export function generateStaticParams() {
  return seedUniversities.map((university) => ({
    slug: university.slug
  }));
}

export async function generateMetadata({ params }: UniversityPageProps) {
  const { slug } = await params;
  const university = findSeedUniversity(slug);

  return {
    title: university
      ? `${university.name} | University AI Policy Tracker`
      : "University not found"
  };
}

export default async function UniversityPage({ params }: UniversityPageProps) {
  const { slug } = await params;
  const university = findSeedUniversity(slug);

  if (!university) {
    notFound();
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="kicker">
          {university.region}, {university.country}
        </p>
        <h1>{university.name}</h1>
        <p className="lead">{university.summary}</p>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Seed policy sources</h2>
          <p>{university.sources.length} placeholder source record</p>
        </div>
        <div className="card-grid">
          {university.sources.map((source) => (
            <article className="policy-card" key={source.url}>
              <div>
                <h3>{source.title}</h3>
                <p>{source.documentStatus}</p>
              </div>
              <div className="tag-row">
                <span className="pill">{source.serviceTreatment}</span>
                <span className="pill">{source.reviewState}</span>
                {source.tools.map((tool) => (
                  <span className="pill" key={tool}>
                    {tool}
                  </span>
                ))}
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

      <section className="section">
        <Link href="/universities">Back to universities</Link>
      </section>
    </main>
  );
}
