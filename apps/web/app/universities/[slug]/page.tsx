import { notFound } from "next/navigation";
import {
  getCatalogUniversities,
  getCatalogUniversityBySlug,
  getPublicJsonUrl,
  getPublicUniversitySummaryBySlug
} from "@/lib/catalog";
import { AnalysisStatusLabel } from "@/components/analysis-status-label";
import { ClaimEvidenceCard } from "@/components/claim-evidence-card";
import { DocumentLink as Link } from "@/components/document-link";
import { EntityHeader } from "@/components/entity-header";
import { EntitySidebar } from "@/components/entity-sidebar";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { ReferenceTabs } from "@/components/reference-tabs";
import { StateLabel } from "@/components/state-label";
import { normalizeLocale } from "@/lib/i18n";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";
import { getPolicyAnalysisProfileBySlug } from "@/lib/policy-analysis";
import { getAnalysisPageQualityApiPath } from "@/lib/policy-analysis-pages";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

interface UniversityPageProps {
  params: Promise<{
    locale?: string;
    slug: string;
  }>;
}

type PublicUniversitySummary = NonNullable<
  Awaited<ReturnType<typeof getPublicUniversitySummaryBySlug>>
>;
type PublicUniversityClaim = PublicUniversitySummary["claims"][number];

const recordTabs = [
  { label: "Overview", href: "#overview" },
  { label: "Policy profile", href: "#policy-profile" },
  { label: "Claims", href: "#claims" },
  { label: "Sources", href: "#sources" },
  { label: "Changes", href: "#changes" },
  { label: "JSON", href: "#json" },
  { label: "Citation", href: "#citation" }
] as const;

export async function generateStaticParams() {
  const universities = await getCatalogUniversities();

  return universities.map((university) => ({
    slug: university.slug
  }));
}

export async function generateMetadata({ params }: UniversityPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = normalizeLocale(localeParam);
  const university = await getCatalogUniversityBySlug(slug);
  const publicSummary = await getPublicUniversitySummaryBySlug(slug);
  const displayName = university
    ? getLocalizedInstitutionName(university.slug, university.name, locale)
    : undefined;
  const alternates = getLocalizedAlternates(`/universities/${slug}`, locale);
  const canonical = String(alternates.canonical);
  const title = university
    ? `${displayName} AI Policy: ChatGPT, GenAI Rules & Sources`
    : "University not found";
  const description = university && publicSummary
    ? `${displayName} AI policy record with ${publicSummary.claims.length} source-backed claims from ${publicSummary.officialSources.length} official sources, review state, last checked date, and public JSON.`
    : university
      ? `${displayName} AI policy record with evidence-backed claims, official sources, review state, confidence, and public JSON.`
    : "University AI Policy Tracker record not found.";

  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article"
    }
  };
}

export default async function UniversityPage({ params }: UniversityPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = normalizeLocale(localeParam);
  const university = await getCatalogUniversityBySlug(slug);
  const publicSummary = await getPublicUniversitySummaryBySlug(slug);
  const policyAnalysisProfile = await getPolicyAnalysisProfileBySlug(slug);

  if (!university || !publicSummary) {
    notFound();
  }
  const displayName = getLocalizedInstitutionName(
    university.slug,
    university.name,
    locale
  );
  const jsonUrl = getPublicJsonUrl(slug);
  const analysisPageQualityPath = getAnalysisPageQualityApiPath();
  const publicJsonUrl =
    publicSummary.apiUrl ?? resolveUrl(jsonUrl, publicSummary.canonicalUrl);
  const publicJsonPath = new URL(publicJsonUrl).pathname;
  const reviewedClaims = publicSummary.claims.filter((claim) =>
    isReviewedClaim(claim.reviewState)
  );
  const candidateClaims = publicSummary.claims.filter(
    (claim) => !isReviewedClaim(claim.reviewState)
  );
  const policyStatus = getPolicyStatus(
    reviewedClaims.length,
    candidateClaims.length,
    publicSummary.officialSources.length
  );
  const canonicalUrl = publicSummary.publicPageUrl ?? publicSummary.canonicalUrl;
  const citationReadySummary = buildCitationReadySummary({
    candidateClaimCount: candidateClaims.length,
    officialSourceCount: publicSummary.officialSources.length,
    publicJsonUrl,
    reviewedClaimCount: reviewedClaims.length,
    summary: publicSummary,
    totalClaimCount: publicSummary.claims.length
  });
  const policySignals = buildPolicySignals(publicSummary.claims);
  const sourceLanguages = getSourceLanguages(publicSummary.claims);
  const recordLead = buildRecordLead({
    candidateClaimCount: candidateClaims.length,
    officialSourceCount: publicSummary.officialSources.length,
    reviewedClaimCount: reviewedClaims.length,
    summary: publicSummary,
    totalClaimCount: publicSummary.claims.length
  });
  const shortAnswer = buildUniversityShortAnswer({
    candidateClaimCount: candidateClaims.length,
    officialSourceCount: publicSummary.officialSources.length,
    reviewedClaimCount: reviewedClaims.length,
    summary: publicSummary,
    totalClaimCount: publicSummary.claims.length
  });

  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: publicSummary.citationTitle,
          description: citationReadySummary,
          url: canonicalUrl,
          dateModified:
            publicSummary.lastChangedAt ?? publicSummary.lastCheckedAt,
          isPartOf: {
            "@type": "WebSite",
            name: "University AI Policy Tracker",
            url: getAbsoluteSiteUrl("/")
          },
          mainEntity: {
            "@type": "Dataset",
            name: publicSummary.citationTitle,
            description: citationReadySummary,
            url: canonicalUrl,
            license: "https://creativecommons.org/licenses/by/4.0/",
            isAccessibleForFree: true,
            creator: {
              "@type": "Organization",
              name: "University AI Policy Tracker",
              url: getAbsoluteSiteUrl("/")
            },
            distribution: {
              "@type": "DataDownload",
              name: `${publicSummary.entity.name} public JSON record`,
              encodingFormat: "application/json",
              contentUrl: publicJsonUrl
            }
          }
        }}
      />

      <EntityHeader
        actions={
          <>
            <div className="entity-header__desktop-actions">
              <a className="site-action" href={publicJsonUrl}>
                Public JSON
              </a>
              <Link className="site-action" href={`/changes/${slug}`}>
                Change log
              </Link>
              <Link className="site-action" href="/citation">
                Citation rules
              </Link>
              <Link className="site-action" href="/datasets">
                Dataset access
              </Link>
              {policyAnalysisProfile ? (
                <a className="site-action" href={policyAnalysisProfile.publicJsonUrl}>
                  Analysis JSON
                </a>
              ) : null}
              <Link className="site-action" href="/contribute">
                Submit correction
              </Link>
            </div>
            <div className="entity-header__mobile-actions">
              <a className="site-action" href={publicJsonUrl}>
                Public JSON
              </a>
              <Link className="site-action" href="/citation">
                Citation rules
              </Link>
              <details className="entity-header__tool-menu">
                <summary>More tools</summary>
                <div>
                  <Link className="site-action" href={`/changes/${slug}`}>
                    Change log
                  </Link>
                  <Link className="site-action" href="/datasets">
                    Dataset access
                  </Link>
                  {policyAnalysisProfile ? (
                    <a className="site-action" href={policyAnalysisProfile.publicJsonUrl}>
                      Analysis JSON
                    </a>
                  ) : null}
                  <Link className="site-action" href="/contribute">
                    Submit correction
                  </Link>
                </div>
              </details>
            </div>
          </>
        }
        eyebrow={`${university.region}, ${university.country}`}
        metadata={
          <>
            {publicSummary.lastCheckedAt ? (
              <MetaLabel label="Last checked">
                {formatDate(publicSummary.lastCheckedAt)}
              </MetaLabel>
            ) : null}
            {publicSummary.lastChangedAt ? (
              <MetaLabel label="Last changed">
                {formatDate(publicSummary.lastChangedAt)}
              </MetaLabel>
            ) : null}
            <StateLabel reviewState={publicSummary.reviewState} />
            {publicSummary.confidence !== undefined ? (
              <MetaLabel label="Confidence">
                {Math.round(publicSummary.confidence * 100)}%
              </MetaLabel>
            ) : null}
          </>
        }
        summary={recordLead}
        title={displayName}
      />

      <ReferenceTabs tabs={recordTabs} />

      <div className="entity-record-layout">
        <div className="entity-record-main">
          <ReferenceBox
            description={`${publicSummary.schemaVersion} public contract`}
            id="overview"
            title={`${displayName} AI policy short answer`}
          >
            <p>{shortAnswer}</p>
            <section
              aria-labelledby="citation-ready-summary"
              className="citation-ready-summary"
            >
              <h3 id="citation-ready-summary">Citation-ready summary</h3>
              <p>{citationReadySummary}</p>
              <div className="tag-row">
                <MetaLabel label="Claim coverage">
                  {formatClaimCoverage(reviewedClaims.length, candidateClaims.length)}
                </MetaLabel>
                <MetaLabel label="Source language">
                  {sourceLanguages.length ? sourceLanguages.join(", ") : "Not specified"}
                </MetaLabel>
                <MetaLabel label="Public JSON">
                  <a href={publicJsonUrl}>{publicJsonPath}</a>
                </MetaLabel>
              </div>
            </section>
            <section aria-labelledby="policy-signals" className="policy-signal-list">
              <h3 id="policy-signals">Policy signals in this record</h3>
              <ul className="compact-list">
                {policySignals.map((signal) => (
                  <li key={signal}>{signal}</li>
                ))}
              </ul>
            </section>
            <div className="tag-row">
              <MetaLabel label="Policy status">{policyStatus}</MetaLabel>
              <StateLabel reviewState={publicSummary.reviewState} />
              <MetaLabel label="Evidence-backed claims">
                {publicSummary.claims.length}
              </MetaLabel>
              <MetaLabel label="Reviewed">{reviewedClaims.length}</MetaLabel>
              <MetaLabel label="Candidate">{candidateClaims.length}</MetaLabel>
              <MetaLabel label="Official sources">
                {publicSummary.officialSources.length}
              </MetaLabel>
            </div>
            <p className="muted">
              This reference record summarizes visible public data only.
              Official sources and original-language evidence remain canonical;
              confidence is separate from review state.
            </p>
            {candidateClaims.length ? (
              <p className="notice-card">
                This record includes candidate or needs-review claims. Candidate
                claims are evidence-backed workflow records, not final policy
                conclusions.
              </p>
            ) : null}
            <p className="notice-card">
              This page is not legal advice, not academic integrity advice, and
              not an official university statement unless a linked source is the
              university&apos;s own official page.
            </p>
          </ReferenceBox>

          {policyAnalysisProfile ? (
            <ReferenceBox
              description="Deterministic source-backed dimensions derived from this record's public claims."
              id="policy-profile"
              title="Policy profile"
              actions={
                <>
                  <a className="site-action" href={policyAnalysisProfile.publicJsonUrl}>
                    Analysis JSON
                  </a>
                  <Link className="site-action" href="/review#analysis-review">
                    Analysis review
                  </Link>
                </>
              }
            >
              <div className="tag-row">
                <MetaLabel label="Coverage score">
                  {policyAnalysisProfile.coverageScore.score}/
                  {policyAnalysisProfile.coverageScore.maxScore}
                </MetaLabel>
                <MetaLabel label="Coverage label">
                  {policyAnalysisProfile.coverageScore.label.replaceAll("_", " ")}
                </MetaLabel>
                <StateLabel reviewState={policyAnalysisProfile.reviewState} />
                <MetaLabel label="Analysis confidence">
                  {Math.round(policyAnalysisProfile.confidence * 100)}%
                </MetaLabel>
              </div>
              <p className="notice-card">
                Policy profile rows are machine-candidate derived metadata. They
                are not final policy conclusions; inspect the linked claim
                evidence before reuse.
              </p>
              <p className="muted">
                Analysis page-quality metadata is available at{" "}
                <a href={analysisPageQualityPath}>{analysisPageQualityPath}</a>.
              </p>
              <div className="analysis-dimension-list">
                {policyAnalysisProfile.dimensions.map((dimension) => (
                  <article
                    className="analysis-dimension-row"
                    data-analysis-status={dimension.status}
                    key={dimension.key}
                  >
                    <div>
                      <h3>{dimension.label}</h3>
                      <p>{dimension.summary}</p>
                      {dimension.notMentionedReason ? (
                        <p className="muted">{dimension.notMentionedReason}</p>
                      ) : null}
                    </div>
                    <div className="analysis-dimension-row__meta">
                      <AnalysisStatusLabel
                        prefix=""
                        status={dimension.status}
                      />
                      <StateLabel
                        prefix=""
                        reviewState={dimension.reviewState}
                      />
                      <MetaLabel label="Confidence">
                        {Math.round(dimension.confidence * 100)}%
                      </MetaLabel>
                      <MetaLabel label="Evidence">
                        {dimension.evidenceCount}
                      </MetaLabel>
                      <MetaLabel label="Sources">{dimension.sourceCount}</MetaLabel>
                    </div>
                    <div className="analysis-dimension-row__links">
                      {dimension.basis.slice(0, 3).map((basis) => (
                        <Link
                          href={`#claim-${basis.claimId}`}
                          key={`${dimension.key}:${basis.claimId}`}
                        >
                          Claim {basis.claimId}
                        </Link>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              <p className="muted">
                Coverage score measures breadth of public, source-backed
                coverage only. It is not a policy quality, strictness, legal
                adequacy, safety, or compliance score.
              </p>
            </ReferenceBox>
          ) : null}

          <section className="record-section" id="claims">
            <div className="section-heading">
              <h2>Evidence-backed claims</h2>
              <p>{reviewedClaims.length} reviewed evidence-backed public claim</p>
            </div>
            {reviewedClaims.length ? (
              <div className="claim-list">
                {reviewedClaims.map((claim) => (
                  <ClaimEvidenceCard
                    claim={claim}
                    id={claim.id ? `claim-${claim.id}` : undefined}
                    key={claim.id ?? claim.claimText}
                    locale={locale}
                  />
                ))}
              </div>
            ) : (
              <p className="notice-card">
                No reviewed claims are published for this record yet. Candidate
                claims remain visible below for source-review workflow
                transparency.
              </p>
            )}
          </section>

          <section className="record-section">
            <div className="section-heading">
              <h2>Candidate claims</h2>
              <p>{candidateClaims.length} machine or needs-review claim</p>
            </div>
            <p className="notice-card">
              Candidate claims are not final policy conclusions. They preserve
              source URL, source snapshot hash, evidence, confidence, and review
              state so the record can be audited before review.
            </p>
            {candidateClaims.length ? (
              <div className="claim-list">
                {candidateClaims.map((claim) => (
                  <ClaimEvidenceCard
                    claim={claim}
                    id={claim.id ? `claim-${claim.id}` : undefined}
                    key={claim.id ?? claim.claimText}
                    locale={locale}
                  />
                ))}
              </div>
            ) : null}
          </section>

          <section className="record-section" id="sources">
            <div className="section-heading">
              <h2>Official sources</h2>
              <p>{publicSummary.officialSources.length} source attribution</p>
            </div>
            <div className="source-attribution-list">
              {publicSummary.officialSources.map((source) => (
                <article
                  className="source-attribution-row"
                  key={`${source.sourceUrl}:${source.snapshotHash}`}
                >
                  <div>
                    <h3>{source.citationTitle}</h3>
                    <p className="muted">
                      {source.publisher ?? "Official university source"}
                    </p>
                  </div>
                  <dl className="source-attribution-row__meta">
                    <div>
                      <dt>Source URL</dt>
                      <dd>
                        <a href={source.sourceUrl}>{source.sourceUrl}</a>
                      </dd>
                    </div>
                    <div>
                      <dt>Snapshot hash</dt>
                      <dd className="hash-value">{source.snapshotHash}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <ReferenceBox
            description="Source-check timeline and diff-style claim/evidence preview."
            id="changes"
            title="Change log"
          >
            <p>
              View the public change record for this university, including
              source snapshot hashes, claim review states, and a diff-style
              preview of current source-backed evidence.
            </p>
            <div className="tag-row">
              {publicSummary.lastCheckedAt ? (
                <MetaLabel label="Last checked">
                  {formatDate(publicSummary.lastCheckedAt)}
                </MetaLabel>
              ) : null}
              {publicSummary.lastChangedAt ? (
                <MetaLabel label="Last changed">
                  {formatDate(publicSummary.lastChangedAt)}
                </MetaLabel>
              ) : null}
              <Link className="site-action" href={`/changes/${slug}`}>
                Open change log
              </Link>
            </div>
          </ReferenceBox>

          <ReferenceBox
            description="Corrections create review tasks and do not directly change this public record."
            title="Corrections and missing evidence"
          >
            <p>
              If an official source is missing, stale, moved, blocked, or
              incorrectly summarized, submit a source URL, policy change report,
              or institution correction for review. Corrections must preserve
              source URLs, source language, original evidence, review state, and
              audit history.
            </p>
            <div className="tag-row">
              <Link className="site-action" href="/contribute">
                Open contribution paths
              </Link>
              <Link className="site-action" href="/review">
                Review workflow
              </Link>
            </div>
          </ReferenceBox>

          <section className="record-section">
            <Link href="/universities">Back to universities</Link>
          </section>
        </div>

        <EntitySidebar
          canonicalUrl={publicSummary.canonicalUrl}
          citationText={publicSummary.suggestedCitation}
          license={publicSummary.license}
          limitations={publicSummary.limitations}
          officialSourceCount={publicSummary.officialSources.length}
          publicJsonUrl={publicJsonUrl}
          sourceRightsPolicy={publicSummary.sourceRightsPolicy}
        />
      </div>
    </main>
  );
}

function isReviewedClaim(reviewState: string): boolean {
  return reviewState === "agent_reviewed" || reviewState === "human_reviewed";
}

function getPolicyStatus(
  reviewedClaimCount: number,
  candidateClaimCount: number,
  sourceCount: number
): string {
  if (reviewedClaimCount > 0) return "Reviewed evidence-backed record";
  if (candidateClaimCount > 0) return "Candidate evidence-backed record";
  if (sourceCount > 0) return "Source-attributed record";

  return "No public claim record yet";
}

function resolveUrl(pathOrUrl: string, baseUrl: string): string {
  return new URL(pathOrUrl, baseUrl).toString();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}

interface RecordLeadInput {
  candidateClaimCount: number;
  officialSourceCount: number;
  reviewedClaimCount: number;
  summary: PublicUniversitySummary;
  totalClaimCount: number;
}

function buildRecordLead({
  candidateClaimCount,
  officialSourceCount,
  reviewedClaimCount,
  summary,
  totalClaimCount
}: RecordLeadInput): string {
  const reviewText = formatReviewState(summary.reviewState);
  const checkedText = summary.lastCheckedAt
    ? ` Last checked ${formatDate(summary.lastCheckedAt)}.`
    : "";
  const candidateText = candidateClaimCount
    ? ` ${candidateClaimCount} candidate claim${candidateClaimCount === 1 ? "" : "s"} remain non-final.`
    : "";

  return `${summary.entity.name} has ${totalClaimCount} source-backed AI policy claim${totalClaimCount === 1 ? "" : "s"} from ${officialSourceCount} official source attribution${officialSourceCount === 1 ? "" : "s"}. Review state: ${reviewText}; ${reviewedClaimCount} reviewed claim${reviewedClaimCount === 1 ? "" : "s"}.${candidateText}${checkedText}`;
}

interface CitationReadySummaryInput {
  candidateClaimCount: number;
  officialSourceCount: number;
  publicJsonUrl: string;
  reviewedClaimCount: number;
  summary: PublicUniversitySummary;
  totalClaimCount: number;
}

function buildUniversityShortAnswer({
  candidateClaimCount,
  officialSourceCount,
  reviewedClaimCount,
  summary,
  totalClaimCount
}: Omit<CitationReadySummaryInput, "publicJsonUrl">): string {
  const reviewText = formatReviewState(summary.reviewState);
  const checkedText = summary.lastCheckedAt
    ? ` Last checked ${formatDate(summary.lastCheckedAt)}.`
    : "";
  const candidateText = candidateClaimCount
    ? ` ${candidateClaimCount} candidate claim${candidateClaimCount === 1 ? "" : "s"} remain non-final.`
    : "";
  const rankingContext = extractRankingContext(summary.summary);

  return `${summary.entity.name} has ${totalClaimCount} source-backed AI policy claim${totalClaimCount === 1 ? "" : "s"} from ${officialSourceCount} official source attribution${officialSourceCount === 1 ? "" : "s"}, including ${reviewedClaimCount} reviewed claim${reviewedClaimCount === 1 ? "" : "s"}. The record review state is ${reviewText}; original-language evidence snippets, source URLs, confidence, and public JSON are preserved for citation.${candidateText}${checkedText}${rankingContext ? ` Discovery context: ${rankingContext}` : ""}`;
}

function buildCitationReadySummary({
  candidateClaimCount,
  officialSourceCount,
  publicJsonUrl,
  reviewedClaimCount,
  summary,
  totalClaimCount
}: CitationReadySummaryInput): string {
  const checkedText = summary.lastCheckedAt
    ? `last checked on ${formatDate(summary.lastCheckedAt)}`
    : "with no last-checked date published yet";
  const changedText = summary.lastChangedAt
    ? ` and last changed on ${formatDate(summary.lastChangedAt)}`
    : "";
  const reviewText = formatReviewStateForRecord(summary.reviewState);
  const confidenceText =
    summary.confidence !== undefined
      ? ` The entity-level confidence is ${Math.round(summary.confidence * 100)}%.`
      : "";
  const candidateText = candidateClaimCount
    ? ` ${candidateClaimCount} claim${candidateClaimCount === 1 ? "" : "s"} still require review and should not be treated as final policy conclusions.`
    : "";

  return `As of this public record, University AI Policy Tracker lists ${summary.entity.name} as ${reviewText} AI policy record ${checkedText}${changedText}. The record contains ${totalClaimCount} source-backed claim${totalClaimCount === 1 ? "" : "s"}, including ${reviewedClaimCount} reviewed claim${reviewedClaimCount === 1 ? "" : "s"}, from ${officialSourceCount} official source attribution${officialSourceCount === 1 ? "" : "s"}. Original-language evidence snippets and source URLs remain canonical, with public JSON available at ${publicJsonUrl}.${confidenceText}${candidateText} This tracker is not legal advice, not academic integrity advice, and not an official university statement unless the linked source is the university's own official page.`;
}

function extractRankingContext(summaryText: string): string {
  const [firstSentence = ""] = summaryText.split(/(?<=\.)\s+/);
  return /\blisted as\b/i.test(firstSentence) ? firstSentence : "";
}

function buildPolicySignals(
  claims: PublicUniversityClaim[]
): string[] {
  const claimTexts = claims.map((claim) => claim.claimText).join(" \n ");
  const signals = new Set<string>();

  for (const claim of claims) {
    const label = claimTypeLabels[claim.claimType] ?? formatReviewState(claim.claimType);
    signals.add(`Evidence includes ${label} claims.`);
  }

  const serviceNames = detectNamedAiServices(claimTexts);
  if (serviceNames.length) {
    signals.add(`Named AI services detected in public claims: ${serviceNames.join(", ")}.`);
  } else {
    signals.add("No specific AI service name is highlighted by the current public claim text.");
  }

  if (/\b(disclos|acknowledg|cite|citation|attribution)\w*/i.test(claimTexts)) {
    signals.add("Disclosure, acknowledgment, citation, or attribution language appears in the public claim text.");
  }

  if (/\b(exam|assessment|coursework|assignment|homework|syllabus)\w*/i.test(claimTexts)) {
    signals.add("Teaching, assessment, coursework, or syllabus-related language appears in the public claim text.");
  }

  if (/\b(privac|personal data|confidential|sensitive|FERPA|GDPR|security)\w*/i.test(claimTexts)) {
    signals.add("Privacy, sensitive-data, or security language appears in the public claim text.");
  }

  return Array.from(signals).slice(0, 8);
}

const claimTypeLabels: Record<string, string> = {
  academic_integrity: "Academic integrity",
  ai_tool_treatment: "AI tool treatment",
  other: "Other policy",
  privacy: "Privacy",
  procurement: "Procurement",
  research: "Research",
  security_review: "Security review",
  source_status: "Source status",
  teaching: "Teaching"
};

function detectNamedAiServices(text: string): string[] {
  const serviceMatchers: Array<[string, RegExp]> = [
    ["ChatGPT", /\bchatgpt\b/i],
    ["DeepSeek", /\bdeepseek\b/i],
    ["Microsoft Copilot", /\b(?:microsoft\s+)?copilot\b/i],
    ["Claude", /\bclaude\b/i],
    ["Gemini", /\bgemini\b/i],
    ["Grammarly", /\bgrammarly\b/i],
    ["DALL-E", /\bdall[-\s]?e\b/i],
    ["Midjourney", /\bmidjourney\b/i]
  ];

  return serviceMatchers
    .filter(([, matcher]) => matcher.test(text))
    .map(([name]) => name);
}

function getSourceLanguages(
  claims: PublicUniversityClaim[]
): string[] {
  const languages = new Set<string>();

  for (const claim of claims) {
    for (const evidence of claim.evidence) {
      if (evidence.sourceLanguage) languages.add(evidence.sourceLanguage);
    }
  }

  return Array.from(languages).sort((left, right) => left.localeCompare(right));
}

function formatClaimCoverage(
  reviewedClaimCount: number,
  candidateClaimCount: number
): string {
  if (!candidateClaimCount) {
    return `${reviewedClaimCount} reviewed`;
  }

  return `${reviewedClaimCount} reviewed, ${candidateClaimCount} needs review`;
}

function formatReviewState(value: string): string {
  return value.replaceAll("_", " ");
}

function formatReviewStateForRecord(value: string): string {
  const phrase = value.replaceAll("_", "-");
  const article = /^[aeiou]/i.test(phrase) ? "an" : "a";

  return `${article} ${phrase}`;
}
