import { translatePolicyReferenceUi } from "@/lib/policy-reference-ui";
import { withLocalePrefix, type SupportedLocale } from "@/lib/i18n";
import type { RelatedUniversityRef } from "@/lib/related-universities";

interface RelatedUniversitiesProps {
  universities: RelatedUniversityRef[];
  locale?: SupportedLocale;
  localizeUi?: boolean;
}

/**
 * Compact related-university links for the index-recovery pilot. Links use
 * clean crawlable canonical hrefs and reuse the existing record-section
 * visual language. The disclaimer keeps the links navigational: a related
 * record never implies the same policy position.
 */
export function RelatedUniversities({ universities, locale = "en", localizeUi = false }: RelatedUniversitiesProps) {
  if (!universities.length) return null;
  const t = (value: string) => localizeUi ? translatePolicyReferenceUi(value, locale) : value;

  return (
    <section className="student-record-section" id="related-universities">
      <div className="section-heading">
        <div>
          <p className="student-policy__eyebrow">Explore</p>
          <h2>{t("Related university AI policy records")}</h2>
        </div>
        <p>
          {t(`${universities.length} record${universities.length === 1 ? "" : "s"}`)}
        </p>
      </div>
      <ul className="related-university-list">
        {universities.map((university) => (
          <li key={university.slug}>
            <a href={localizeUi ? withLocalePrefix(`/universities/${university.slug}`, locale) : `/universities/${university.slug}`}>{university.name}</a>
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
