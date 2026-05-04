import Link from "next/link";
import { seedUniversities } from "@uapt/shared";

const routeGroups = [
  { label: "Universities", href: "/universities" },
  { label: "AI tools", href: "/tools" },
  { label: "Reports", href: "/reports" }
] as const;

export default function HomePage() {
  const sourceCount = seedUniversities.reduce(
    (total, university) => total + university.sources.length,
    0
  );

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="kicker">Public policy-change intelligence</p>
        <h1>University AI Policy Tracker</h1>
        <p className="lead">
          Track source-backed university policy changes for GenAI, ChatGPT,
          DeepSeek, Microsoft Copilot, institutional AI services, academic
          integrity, privacy, teaching, research, security review, and procurement.
        </p>
      </section>

      <section className="metrics-grid" aria-label="Seed dataset summary">
        <div>
          <span>{seedUniversities.length}</span>
          <p>seed universities</p>
        </div>
        <div>
          <span>{sourceCount}</span>
          <p>seed sources</p>
        </div>
        <div>
          <span>0</span>
          <p>deployed services</p>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Initial route groups</h2>
          <p>Static placeholders wired to shared seed data.</p>
        </div>
        <div className="link-grid">
          {routeGroups.map((routeGroup) => (
            <Link className="text-card" href={routeGroup.href} key={routeGroup.href}>
              {routeGroup.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
