import type { RelatedUniversityRef } from "@/lib/related-universities";

interface RelatedUniversitiesProps {
  universities: RelatedUniversityRef[];
}

/**
 * Compact related-university links for the index-recovery pilot. Links use
 * clean crawlable canonical hrefs and reuse the existing record-section
 * visual language. The disclaimer keeps the links navigational: a related
 * record never implies the same policy position.
 */
export function RelatedUniversities({ universities }: RelatedUniversitiesProps) {
  if (!universities.length) return null;

  return (
    <section className="student-record-section" id="related-universities">
      <div className="section-heading">
        <div>
          <p className="student-policy__eyebrow">Explore</p>
          <h2>Related university AI policy records</h2>
        </div>
        <p>
          {universities.length} record{universities.length === 1 ? "" : "s"}
        </p>
      </div>
      <ul className="related-university-list">
        {universities.map((university) => (
          <li key={university.slug}>
            <a href={`/universities/${university.slug}`}>{university.name}</a>
            <span className="related-university-list__meta">
              {university.country}
            </span>
          </li>
        ))}
      </ul>
      <p className="muted">
        Selected by country and shared reviewed policy topics. Each university
        sets its own AI policy; these links do not imply the same rules.
      </p>
    </section>
  );
}
