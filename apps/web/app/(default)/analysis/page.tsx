import Link from "next/link";
import {
  NO_ADVICE_BOUNDARY,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE
} from "@uapt/shared";
import { AnalysisStatusLabel } from "@/components/analysis-status-label";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { DataList, DataListRow } from "@/components/data-list";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import {
  getPolicyAnalysisDimensions,
  getPolicyAnalysisProfiles
} from "@/lib/policy-analysis";
import {
  analysisThemeSpecs,
  buildAnalysisReviewWorkflow,
  buildAnalysisCitationReadySummary,
  buildPolicyAnalysisPageQualityResponse,
  formatCoverageScore,
  getDimensionCoverageSummary,
  getAnalysisPageQualityApiPath,
  getPublishableAnalysisThemeSpecs
} from "@/lib/policy-analysis-pages";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { normalizeLocale } from "@/lib/i18n";
import { getPageCopy } from "@/lib/page-copy";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

interface AnalysisIndexPageProps {
  params?: Promise<{
    locale?: string;
  }>;
}

export async function generateMetadata({
  params
}: AnalysisIndexPageProps = {}) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).analysis;
  const alternates = getLocalizedAlternates("/analysis", locale);
  const canonical = String(alternates.canonical);

  return {
    title: copy.title,
    description: copy.description,
    alternates,
    openGraph: {
      title: copy.title,
      description: copy.description,
      url: canonical,
      type: "website"
    }
  };
}

export default async function AnalysisIndexPage({ params }: AnalysisIndexPageProps) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).analysis;
  const profiles = await getPolicyAnalysisProfiles();
  const publishableThemes = await getPublishableAnalysisThemeSpecs();
  const dimensions = getPolicyAnalysisDimensions();
  const dimensionSummary = getDimensionCoverageSummary(profiles);
  const evidenceBackedDimensionCount = profiles.reduce(
    (total, profile) =>
      total +
      profile.dimensions.filter((dimension) => dimension.evidenceCount > 0)
        .length,
    0
  );
  const averageCoverageScore =
    profiles.reduce(
      (total, profile) => total + profile.coverageScore.score,
      0
    ) / profiles.length;
  const sourceLanguageCount = new Set(
    profiles.flatMap((profile) => profile.sourceLanguages)
  ).size;
  const qualityReport = await buildPolicyAnalysisPageQualityResponse();
  const reviewWorkflow = buildAnalysisReviewWorkflow();
  const analysisIndexPath = `/api/public/${PUBLIC_API_VERSION}/analysis/index.json`;
  const coverageScoresPath = `/api/public/${PUBLIC_API_VERSION}/analysis/coverage-scores.json`;
  const pageQualityPath = getAnalysisPageQualityApiPath();
  const exampleSlug =
    profiles.find((profile) => profile.entitySlug === "anu")?.entitySlug ??
    profiles[0]?.entitySlug ??
    "anu";
  const exampleProfilePath = `/api/public/${PUBLIC_API_VERSION}/analysis/universities/${exampleSlug}.json`;
  const citationReadySummary = buildAnalysisCitationReadySummary({
    label: "policy dimension",
    profileCount: profiles.length,
    evidenceBackedCount: evidenceBackedDimensionCount,
    statusCounts: dimensionSummary.flatMap((summary) => summary.statusCounts)
  });

  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: "University AI Policy Tracker policy analysis profiles",
          description: copy.description,
          url: getAbsoluteSiteUrl("/analysis"),
          license: "https://creativecommons.org/licenses/by/4.0/",
          isAccessibleForFree: true,
          creator: {
            "@type": "Organization",
            name: "University AI Policy Tracker",
            url: getAbsoluteSiteUrl("/")
          },
          includedInDataCatalog: {
            "@type": "DataCatalog",
            name: "University AI Policy Tracker",
            url: getAbsoluteSiteUrl("/")
          },
          distribution: [
            {
              "@type": "DataDownload",
              name: "Policy analysis API index",
              encodingFormat: "application/json",
              contentUrl: getAbsoluteSiteUrl(analysisIndexPath)
            },
            {
              "@type": "DataDownload",
              name: "Policy coverage scores JSON",
              encodingFormat: "application/json",
              contentUrl: getAbsoluteSiteUrl(coverageScoresPath)
            }
          ],
          keywords: [
            "university AI policy",
            "generative AI policy",
            "AI disclosure",
            "policy analysis",
            "open data"
          ]
        }}
      />

      <section className="hero">
        <p className="kicker">{copy.kicker}</p>
        <h1>{copy.heading}</h1>
        <p className="lead">{copy.lead}</p>
        <div className="tag-row hero-meta">
          <MetaLabel label={copy.profiles}>{profiles.length}</MetaLabel>
          <MetaLabel label={copy.schema}>uapt-policy-analysis-v1</MetaLabel>
          <StateLabel reviewState="machine_candidate" />
          <MetaLabel label={copy.publicApi}>{analysisIndexPath}</MetaLabel>
        </div>
      </section>

      <section className="metrics-grid" aria-label={copy.coverageLabel}>
        <div>
          <span>{profiles.length}</span>
          <p>{copy.analysisProfiles}</p>
        </div>
        <div>
          <span>{evidenceBackedDimensionCount}</span>
          <p>{copy.evidenceBackedDimensions}</p>
        </div>
        <div>
          <span>{formatCoverageScore(Math.round(averageCoverageScore))}</span>
          <p>{copy.averageCoverageScore}</p>
        </div>
        <div>
          <span>{sourceLanguageCount}</span>
          <p>{copy.sourceLanguagesPreserved}</p>
        </div>
      </section>

      <section className="answer-strip" aria-label={copy.answersLabel}>
        {copy.answers.map((answer) => (
          <article className="answer-card" key={answer.title}>
            <h2>{answer.title}</h2>
            <p>{answer.text}</p>
          </article>
        ))}
      </section>

      <ReferenceBox
        className="compact-reference-box"
        description={copy.summaryDescription}
        title={copy.summaryTitle}
      >
        <p>{citationReadySummary}</p>
        <p className="notice-card">
          {copy.scoreNotice}
        </p>
      </ReferenceBox>

      <div className="docs-layout">
        <nav className="docs-toc" aria-label={copy.tocLabel}>
          <a href="#meaning">{copy.toc.meaning}</a>
          <a href="#dimensions">{copy.toc.dimensions}</a>
          <a href="#coverage">{copy.toc.coverage}</a>
          <a href="#themes">{copy.toc.themes}</a>
          <a href="#quality">{copy.toc.quality}</a>
          <a href="#review">{copy.toc.review}</a>
          <a href="#json">{copy.toc.json}</a>
          <a href="#citation">{copy.toc.citation}</a>
        </nav>

        <div className="docs-content">
          <ReferenceBox
            description={copy.meaningDescription}
            id="meaning"
            title={copy.toc.meaning}
          >
            <ul className="compact-list">
              {copy.boundaryRules.slice(0, 3).map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
              <li>{NO_ADVICE_BOUNDARY}</li>
              {copy.boundaryRules.slice(3).map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </ReferenceBox>

          <ReferenceBox
            description={copy.dimensionsDescription}
            id="dimensions"
            title={copy.toc.dimensions}
          >
            <DataList>
              {dimensions.map((dimension) => {
                const summary = dimensionSummary.find(
                  (item) => item.key === dimension.key
                );

                return (
                  <DataListRow
                    key={dimension.key}
                    metadata={
                      <>
                        <MetaLabel label={copy.evidenceBacked}>
                          {summary?.evidenceBackedCount ?? 0}
                        </MetaLabel>
                        <MetaLabel label={copy.notMentioned}>
                          {summary?.notMentionedCount ?? 0}
                        </MetaLabel>
                      </>
                    }
                  >
                    <h2>{dimension.label}</h2>
                    <p>{dimension.description}</p>
                    {summary?.statusCounts.length ? (
                      <div className="tag-row">
                        {summary.statusCounts.slice(0, 4).map((status) => (
                          <AnalysisStatusLabel
                            key={status.status}
                            prefix={`${status.count}`}
                            status={status.status}
                          />
                        ))}
                      </div>
                    ) : null}
                  </DataListRow>
                );
              })}
            </DataList>
          </ReferenceBox>

          <ReferenceBox
            description={copy.coverageDescription}
            id="coverage"
            title={copy.toc.coverage}
            actions={
              <Link className="site-action" href="/analysis/policy-coverage">
                {copy.openCoverageTable}
              </Link>
            }
          >
            <p>{copy.coverageText}</p>
            <p className="notice-card">{copy.coverageWarning}</p>
          </ReferenceBox>

          <ReferenceBox
            description={copy.qualityDescription}
            id="quality"
            title={copy.toc.quality}
            actions={
              <a className="site-action" href={pageQualityPath}>
                {copy.pageQualityJson}
              </a>
            }
          >
            <p>
              {copy.qualityStatus(
                qualityReport.data.status.replaceAll("_", " "),
                qualityReport.data.pages.length
              )}
            </p>
            <DataList>
              {qualityReport.data.qualityGates.map((gate) => (
                <DataListRow
                  key={gate.gateId}
                  metadata={<MetaLabel label={copy.gate}>{gate.gateId}</MetaLabel>}
                >
                  <h2>{gate.label}</h2>
                  <p>{gate.requirement}</p>
                </DataListRow>
              ))}
            </DataList>
          </ReferenceBox>

          <ReferenceBox
            description={copy.reviewDescription}
            id="review"
            title={copy.toc.review}
            actions={
              <Link className="site-action" href="/review#analysis-review">
                {copy.openReviewWorkflow}
              </Link>
            }
          >
            <p>{reviewWorkflow.publicationGate}</p>
            <div className="tag-row">
              <MetaLabel label={copy.queue}>{reviewWorkflow.reviewQueue}</MetaLabel>
              <MetaLabel label={copy.publicMutation}>{copy.notAllowed}</MetaLabel>
              <MetaLabel label={copy.reviewStates}>
                {reviewWorkflow.reviewStates.length}
              </MetaLabel>
            </div>
          </ReferenceBox>

          <ReferenceBox
            description={copy.themesDescription}
            id="themes"
            title={copy.toc.themes}
          >
            <div className="detail-grid">
              {analysisThemeSpecs.map((spec) => {
                const published = publishableThemes.some(
                  (theme) => theme.slug === spec.slug
                );

                return (
                  <article className="policy-card" key={spec.slug}>
                    <h3>{spec.label}</h3>
                    <p>{spec.description}</p>
                    {published ? (
                      <Link href={`/analysis/${spec.slug}`}>{copy.openAnalysis}</Link>
                    ) : (
                      <span className="pill">{copy.held}</span>
                    )}
                  </article>
                );
              })}
            </div>
          </ReferenceBox>

          <ReferenceBox
            description={copy.jsonDescription}
            id="json"
            title={copy.toc.json}
          >
            <ApiEndpointRow
              description={copy.analysisIndexDescription}
              label={copy.analysisIndex}
              path={analysisIndexPath}
              url={getAbsoluteSiteUrl(analysisIndexPath)}
            />
            <ApiEndpointRow
              description={copy.universityAnalysisProfileDescription}
              label={copy.universityAnalysisProfile}
              path={exampleProfilePath}
              url={getAbsoluteSiteUrl(exampleProfilePath)}
            />
            <ApiEndpointRow
              description={copy.coverageScoresDescription}
              label={copy.coverageScores}
              path={coverageScoresPath}
              url={getAbsoluteSiteUrl(coverageScoresPath)}
            />
            <ApiEndpointRow
              description={copy.analysisPageQualityDescription}
              label={copy.analysisPageQuality}
              path={pageQualityPath}
              url={getAbsoluteSiteUrl(pageQualityPath)}
            />
          </ReferenceBox>

          <ReferenceBox
            description={copy.citationDescription}
            id="citation"
            title={copy.toc.citation}
          >
            <p>
              {copy.suggestedCitation}: University AI Policy Tracker. "University AI
              policy analysis profiles." Version {PUBLIC_API_VERSION}.{" "}
              {getAbsoluteSiteUrl("/analysis")}
            </p>
            <p>
              Tracker metadata uses {TRACKER_METADATA_LICENSE}. Official source
              documents, source page text, PDFs, and other source materials
              retain their original rights and terms.
            </p>
          </ReferenceBox>
        </div>
      </div>
    </main>
  );
}
