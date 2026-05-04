import { aiTools, seedUniversities } from "@uapt/shared";

export const metadata = {
  title: "AI Tools | University AI Policy Tracker"
};

export default function ToolsPage() {
  const toolCounts = aiTools.map((tool) => ({
    tool,
    count: seedUniversities.reduce(
      (total, university) =>
        total +
        university.sources.filter((source) => source.tools.includes(tool)).length,
      0
    )
  }));

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
          {toolCounts.map(({ tool, count }) => (
            <article className="policy-card" key={tool}>
              <h2>{tool}</h2>
              <p>{count} seed source references this tool.</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
