import { CitationCopyActions } from "@/components/citation-copy-actions";
import { DocumentLink as Link } from "@/components/document-link";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import { DEFAULT_LOCALE, type SupportedLocale } from "@/lib/i18n";
import { translateSurfaceText } from "@/lib/surface-localization";

interface EntitySidebarProps {
  canonicalUrl: string;
  citationText: string;
  entitySlug?: string;
  officialSourceCount: number;
  locale?: SupportedLocale;
  publicJsonUrl: string;
}

const reviewStates = [
  "human_reviewed",
  "agent_reviewed",
  "machine_candidate",
  "needs_review",
  "rejected"
] as const;

export function EntitySidebar({
  canonicalUrl,
  citationText,
  entitySlug,
  locale = DEFAULT_LOCALE,
  officialSourceCount,
  publicJsonUrl
}: EntitySidebarProps) {
  const t = (value: string) => translateSurfaceText(value, locale);
  return (
    <aside className="entity-sidebar" aria-label={t("Record reference details")}>
      <ReferenceBox id="citation" title={t("Suggested citation")} headingLevel="h3">
        <CitationCopyActions
          canonicalUrl={canonicalUrl}
          citationText={citationText}
          entitySlug={entitySlug}
          locale={locale}
          publicJsonUrl={publicJsonUrl}
        />
        <ul className="source-list">
          <li>
            <a
              data-analytics-entity-slug={entitySlug}
              data-analytics-event="record_canonical_click"
              href={canonicalUrl}
            >
              {t("Canonical page")}
            </a>
          </li>
          <li>
            <Link href="/citation">{t("Citation rules")}</Link>
          </li>
        </ul>
      </ReferenceBox>

      <ReferenceBox id="json" title={t("Public JSON")} headingLevel="h3">
        <ul className="source-list">
          <li>
            <a
              data-analytics-entity-slug={entitySlug}
              data-analytics-event="record_public_json_click"
              href={publicJsonUrl}
            >
              {t("Open public JSON")}
            </a>
          </li>
          <li>
            <Link href="/datasets">{t("Dataset access")}</Link>
          </li>
        </ul>
      </ReferenceBox>

      <ReferenceBox title={t("Official sources")} headingLevel="h3">
        <MetaLabel label={t("Sources")}>{officialSourceCount}</MetaLabel>
      </ReferenceBox>

      <ReferenceBox title={t("License and limitations")} headingLevel="h3">
        <ul className="source-list">
          <li>
            <Link href="/citation">{t("Citation")}</Link>
          </li>
          <li>
            <Link href="/methodology">{t("Methodology")}</Link>
          </li>
          <li>
            <Link href="/review">{t("Review")}</Link>
          </li>
        </ul>
      </ReferenceBox>

      <ReferenceBox title={t("Review states")} headingLevel="h3">
        <ul className="review-state-list">
          {reviewStates.map((reviewState) => (
            <li key={reviewState}>
              <StateLabel locale={locale} prefix="" reviewState={reviewState} />
            </li>
          ))}
        </ul>
      </ReferenceBox>
    </aside>
  );
}
