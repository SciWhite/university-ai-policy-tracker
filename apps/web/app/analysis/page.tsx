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
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "Policy Analysis | University AI Policy Tracker";
const description =
  "Deterministic, evidence-backed university AI policy analysis profiles with source claim IDs, review states, coverage scores, and versioned public JSON.";

export function generateMetadata() {
  const canonical = getAbsoluteSiteUrl("/analysis");

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website"
    }
  };
}

export default async function AnalysisIndexPage() {
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
          description,
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
        <p className="kicker">Policy analysis</p>
        <h1>Source-backed analysis profiles, not policy advice</h1>
        <p className="lead">
          The analysis layer turns public claim/evidence records into
          deterministic policy dimensions. Every non-empty conclusion links back
          to claim IDs, source URLs, source language, and original evidence.
        </p>
        <div className="tag-row hero-meta">
          <MetaLabel label="Profiles">{profiles.length}</MetaLabel>
          <MetaLabel label="Schema">uapt-policy-analysis-v1</MetaLabel>
          <StateLabel reviewState="machine_candidate" />
          <MetaLabel label="Public API">{analysisIndexPath}</MetaLabel>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Policy analysis coverage">
        <div>
          <span>{profiles.length}</span>
          <p>analysis profiles</p>
        </div>
        <div>
          <span>{evidenceBackedDimensionCount}</span>
          <p>evidence-backed dimensions</p>
        </div>
        <div>
          <span>{formatCoverageScore(Math.round(averageCoverageScore))}</span>
          <p>average public coverage score</p>
        </div>
        <div>
          <span>{sourceLanguageCount}</span>
          <p>source languages preserved</p>
        </div>
      </section>

      <ReferenceBox
        description="Short answer for researchers, journalists, and AI answer engines."
        title="Citation-ready summary"
      >
        <p>{citationReadySummary}</p>
        <p className="notice-card">
          Policy Coverage Score measures breadth of public, source-backed
          coverage. It is not a quality, strictness, legal adequacy, safety, or
          institutional compliance score.
        </p>
      </ReferenceBox>

      <div className="docs-layout">
        <nav className="docs-toc" aria-label="Analysis sections">
          <a href="#meaning">What it means</a>
          <a href="#dimensions">Dimensions</a>
          <a href="#coverage">Coverage score</a>
          <a href="#themes">Theme analysis</a>
          <a href="#quality">Quality gates</a>
          <a href="#review">Review workflow</a>
          <a href="#json">Public JSON</a>
          <a href="#citation">Citation</a>
        </nav>

        <div className="docs-content">
          <ReferenceBox
            description="The analysis layer is deliberately conservative."
            id="meaning"
            title="What this analysis means"
          >
            <ul className="compact-list">
              <li>
                It summarizes public tracker claims into consistent dimensions
                such as disclosure, coursework, exams, privacy, approved tools,
                and academic integrity.
              </li>
              <li>
                It preserves original-language evidence as canonical and uses
                localized display only as helper text.
              </li>
              <li>
                It keeps confidence separate from review state. Current analysis
                profiles are machine candidates until reviewed.
              </li>
            </ul>
          </ReferenceBox>

          <ReferenceBox
            description="Boundaries are part of the visible record."
            title="What this analysis does not mean"
          >
            <ul className="compact-list">
              <li>{NO_ADVICE_BOUNDARY}</li>
              <li>
                `not_mentioned` means the current public tracker profile does
                not contain source-backed evidence for that dimension. It does
                not mean the policy does not exist.
              </li>
              <li>
                Analysis status is derived metadata. Users should inspect the
                basis claim IDs and source URLs before reuse.
              </li>
            </ul>
          </ReferenceBox>

          <ReferenceBox
            description="All dimensions are visible and contract-backed."
            id="dimensions"
            title="Analysis dimensions"
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
                        <MetaLabel label="Evidence-backed">
                          {summary?.evidenceBackedCount ?? 0}
                        </MetaLabel>
                        <MetaLabel label="Not mentioned">
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
            description="The score is a coverage breadth measure only."
            id="coverage"
            title="Coverage score"
            actions={
              <Link className="site-action" href="/analysis/policy-coverage">
                Open coverage table
              </Link>
            }
          >
            <p>
              Coverage score components sum to 100 points across public evidence
              categories such as central guidance, academic integrity,
              disclosure, coursework, exams, privacy/data entry, approved tools,
              and teaching or research guidance.
            </p>
            <p className="notice-card">
              The score should never be described as best policy, worst policy,
              most compliant, legally safe, or institutionally endorsed.
            </p>
          </ReferenceBox>

          <ReferenceBox
            description="Publication gates keep analysis pages useful for search and AI answer engines without turning sparse data into thin pages."
            id="quality"
            title="Analysis page quality gates"
            actions={
              <a className="site-action" href={pageQualityPath}>
                Page-quality JSON
              </a>
            }
          >
            <p>
              Current page-quality status:{" "}
              {qualityReport.data.status.replaceAll("_", " ")}. The report
              covers {qualityReport.data.pages.length} public analysis pages and
              keeps review state separate from page publication readiness.
            </p>
            <DataList>
              {qualityReport.data.qualityGates.map((gate) => (
                <DataListRow
                  key={gate.gateId}
                  metadata={<MetaLabel label="Gate">{gate.gateId}</MetaLabel>}
                >
                  <h2>{gate.label}</h2>
                  <p>{gate.requirement}</p>
                </DataListRow>
              ))}
            </DataList>
          </ReferenceBox>

          <ReferenceBox
            description="Quality checks do not publish canonical analysis. They route questionable records into review."
            id="review"
            title="Analysis review workflow"
            actions={
              <Link className="site-action" href="/review#analysis-review">
                Open review workflow
              </Link>
            }
          >
            <p>{reviewWorkflow.publicationGate}</p>
            <div className="tag-row">
              <MetaLabel label="Queue">{reviewWorkflow.reviewQueue}</MetaLabel>
              <MetaLabel label="Public mutation">Not allowed</MetaLabel>
              <MetaLabel label="Review states">
                {reviewWorkflow.reviewStates.length}
              </MetaLabel>
            </div>
          </ReferenceBox>

          <ReferenceBox
            description="Only themes with enough public evidence are linked from this index."
            id="themes"
            title="Theme analysis pages"
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
                      <Link href={`/analysis/${spec.slug}`}>Open analysis</Link>
                    ) : (
                      <span className="pill">Held until evidence threshold</span>
                    )}
                  </article>
                );
              })}
            </div>
          </ReferenceBox>

          <ReferenceBox
            description="Versioned read-only endpoints for downstream reuse."
            id="json"
            title="Public JSON endpoints"
          >
            <ApiEndpointRow
              description="Analysis endpoint manifest with dimension definitions and version metadata."
              label="Analysis index"
              path={analysisIndexPath}
              url={getAbsoluteSiteUrl(analysisIndexPath)}
            />
            <ApiEndpointRow
              description="Example per-university analysis profile with dimensions, basis evidence, and coverage score."
              label="University analysis profile"
              path={exampleProfilePath}
              url={getAbsoluteSiteUrl(exampleProfilePath)}
            />
            <ApiEndpointRow
              description="Coverage score list for public analysis profiles."
              label="Coverage scores"
              path={coverageScoresPath}
              url={getAbsoluteSiteUrl(coverageScoresPath)}
            />
            <ApiEndpointRow
              description="Read-only report of page-quality gates, indexability status, analysis review workflow, and no-advice boundaries."
              label="Analysis page quality"
              path={pageQualityPath}
              url={getAbsoluteSiteUrl(pageQualityPath)}
            />
          </ReferenceBox>

          <ReferenceBox
            description="Use the canonical page and public JSON together."
            id="citation"
            title="Citation format"
          >
            <p>
              Suggested citation: University AI Policy Tracker. "University AI
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
