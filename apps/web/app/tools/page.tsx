import { getCatalogTools } from "@/lib/catalog";

export const metadata = {
  title: "AI Tools | University AI Policy Tracker"
};

export default async function ToolsPage() {
  const toolCounts = await getCatalogTools();

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="kicker">Seed taxonomy</p>
        <h1>AI tools</h1>
        <p className="lead">
          Placeholder index for named AI tools and institutional AI services found
          in university policy sources.
        </p>
      </section>

      <section className="section">
        <div className="card-grid">
          {toolCounts.map(({ tool, sourceCount, universityCount }) => (
            <article className="policy-card" key={tool}>
              <h2>{tool}</h2>
              <p>
                {sourceCount} source references this tool across {universityCount}{" "}
                universities.
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
