const routeGroups = [
  "Universities",
  "AI tools",
  "Regions",
  "Governance themes",
  "Sources",
  "Diffs",
  "Reports"
];

export default function HomePage() {
  return (
    <main
      style={{
        margin: "0 auto",
        maxWidth: "960px",
        padding: "64px 24px"
      }}
    >
      <p style={{ color: "var(--accent)", fontWeight: 700, margin: 0 }}>
        Public policy-change intelligence
      </p>
      <h1 style={{ fontSize: "44px", lineHeight: 1.1, margin: "16px 0" }}>
        University AI Policy Tracker
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "18px", lineHeight: 1.6 }}>
        Track source-backed university policy changes for GenAI, ChatGPT,
        DeepSeek, Microsoft Copilot, institutional AI services, academic
        integrity, privacy, teaching, research, security review, and procurement.
      </p>
      <section style={{ borderTop: "1px solid var(--border)", marginTop: 40, paddingTop: 24 }}>
        <h2 style={{ fontSize: "20px" }}>Initial public route groups</h2>
        <ul style={{ columns: 2, lineHeight: 1.9, paddingLeft: 20 }}>
          {routeGroups.map((routeGroup) => (
            <li key={routeGroup}>{routeGroup}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
