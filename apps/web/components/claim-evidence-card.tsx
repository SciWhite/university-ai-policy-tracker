import type {
  ClaimEvidence,
  ClaimReviewState,
  PolicyClaim
} from "@uapt/shared";
import {
  DEFAULT_LOCALE,
  getLocaleLabel,
  getUiString,
  isSupportedLocale,
  type SupportedLocale
} from "@/lib/i18n";
import { MetaLabel } from "@/components/meta-label";
import { StateLabel } from "@/components/state-label";
import { getSourceDomain } from "@/lib/analytics-events";
import { translateSurfaceText } from "@/lib/surface-localization";

interface ClaimEvidenceCardProps {
  claim: PolicyClaim;
  entitySlug?: string;
  id?: string;
  locale?: SupportedLocale;
}

const reviewNotes: Partial<Record<ClaimReviewState, string>> = {
  machine_candidate:
    "Machine candidates are source-backed records awaiting review and are not final policy conclusions.",
  needs_review:
    "This claim is held for review because the evidence or classification needs another pass.",
  rejected:
    "This claim is retained for audit context and should not be treated as a public conclusion."
};

export function ClaimEvidenceCard({
  claim,
  entitySlug,
  id,
  locale = DEFAULT_LOCALE
}: ClaimEvidenceCardProps) {
  return (
    <article
      className="claim-evidence-card"
      data-review-state={claim.reviewState}
      id={id}
    >
      <header className="claim-evidence-card__header">
        <div>
          <p className="claim-evidence-card__type">
            {translateSurfaceText(formatClaimType(claim.claimType), locale)}
          </p>
          <h3>{claim.claimText}</h3>
        </div>
        <div className="claim-evidence-card__status">
          <StateLabel locale={locale} reviewState={claim.reviewState} />
          <MetaLabel label={translateSurfaceText("Confidence", locale)}>
            {Math.round(claim.confidence * 100)}%
          </MetaLabel>
        </div>
      </header>

      {claim.claimValue ? (
        <p className="claim-value">
          {translateSurfaceText("Normalized value", locale)}: {claim.claimValue}
        </p>
      ) : null}

      {reviewNotes[claim.reviewState] ? (
        <p className="claim-state-note">
          {translateSurfaceText(reviewNotes[claim.reviewState] ?? "", locale)}
        </p>
      ) : null}

      {claim.lastCheckedAt || claim.lastChangedAt ? (
        <dl className="claim-metadata-grid">
          {claim.lastCheckedAt ? (
            <div>
              <dt>{translateSurfaceText("Last checked", locale)}</dt>
              <dd>{formatDate(claim.lastCheckedAt, locale)}</dd>
            </div>
          ) : null}
          {claim.lastChangedAt ? (
            <div>
              <dt>{translateSurfaceText("Last changed", locale)}</dt>
              <dd>{formatDate(claim.lastChangedAt, locale)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="evidence-stack">
        {claim.evidence.map((evidence, index) => (
          <EvidenceBlock
            evidence={evidence}
            entitySlug={entitySlug}
            index={index}
            key={`${evidence.sourceUrl}:${evidence.sourceSnapshotHash}:${index}`}
            locale={locale}
          />
        ))}
      </div>
    </article>
  );
}

function EvidenceBlock({
  evidence,
  entitySlug,
  index,
  locale
}: {
  evidence: ClaimEvidence;
  entitySlug?: string;
  index: number;
  locale: SupportedLocale;
}) {
  return (
    <section className="evidence-block">
      <div className="evidence-block__heading">
        <p>{getUiString("originalEvidence", locale)}</p>
        <span>{translateSurfaceText("Evidence", locale)} {index + 1}</span>
      </div>

      <blockquote className="evidence-snippet">
        {evidence.evidenceSnippet}
        <footer>
          {translateSurfaceText("Source", locale)}:{" "}
          <a
            data-analytics-entity-slug={entitySlug}
            data-analytics-event="official_source_click"
            data-analytics-source-domain={getSourceDomain(evidence.sourceUrl)}
            href={evidence.sourceUrl}
          >
            {evidence.attribution.citationTitle}
          </a>
        </footer>
      </blockquote>

      {evidence.evidenceSnippetDisplay ? (
        <div className="localized-evidence">
          <p>
            {getUiString("localizedDisplay", locale)} {translateSurfaceText("only", locale)}
          </p>
          <p>{evidence.evidenceSnippetDisplay}</p>
        </div>
      ) : null}

      <dl className="claim-metadata-grid">
        <div>
          <dt>{getUiString("sourceLanguage", locale)}</dt>
          <dd>{formatSourceLanguage(evidence.sourceLanguage, locale)}</dd>
        </div>
        <div>
          <dt>{getUiString("snapshotHash", locale)}</dt>
          <dd className="hash-value">{evidence.sourceSnapshotHash}</dd>
        </div>
        {evidence.retrievedAt ? (
          <div>
            <dt>{translateSurfaceText("Retrieved", locale)}</dt>
            <dd>{formatDate(evidence.retrievedAt, locale)}</dd>
          </div>
        ) : null}
        {evidence.snippetLocation ? (
          <div>
            <dt>{translateSurfaceText("Evidence locator", locale)}</dt>
            <dd>{evidence.snippetLocation}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

function formatClaimType(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSourceLanguage(
  value: string | undefined,
  locale: SupportedLocale
): string {
  if (!value) return translateSurfaceText("Unknown", locale);

  const normalized = value.toLowerCase().split("-")[0];
  if (!isSupportedLocale(normalized)) return value;

  return `${getLocaleLabel(normalized)} (${value})`;
}

function formatDate(value: string, locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}
