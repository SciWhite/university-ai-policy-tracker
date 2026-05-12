import Link from "next/link";
import { notFound } from "next/navigation";
import {
  NO_ADVICE_BOUNDARY,
  PUBLIC_API_VERSION,
  TRACKER_METADATA_LICENSE
} from "@uapt/shared";
import { AnalysisStatusLabel } from "@/components/analysis-status-label";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import {
  getPolicyAnalysisProfiles,
  getPolicyAnalysisApiPath
} from "@/lib/policy-analysis";
import {
  buildAnalysisCitationReadySummary,
  formatCoverageScore,
  getAnalysisThemeSummary,
  getCoverageRows,
  getPublishableAnalysisThemeSpecs
} from "@/lib/policy-analysis-pages";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

interface AnalysisRouteProps {
  params: Promise<{
    slug: string;
  }>;
}

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const themes = await getPublishableAnalysisThemeSpecs();

  return [
    { slug: "policy-coverage" },
    ...themes.map((theme) => ({ slug: theme.slug }))
  ];
}

export async function generateMetadata({ params }: AnalysisRouteProps) {
  const { slug } = await params;
  const canonical = getAbsoluteSiteUrl(`/analysis/${slug}`);

  if (slug === "policy-coverage") {
    return {
      title: "Policy Coverage Score Analysis | University AI Policy Tracker",
      description:
        "Sorted university policy coverage scores with caveats, source-backed dimensions, review states, and public JSON links.",
      alternates: { canonical },
      openGraph: {
        title: "Policy Coverage Score Analysis",
        description:
          "Coverage score analysis for public university AI policy records.",
        url: canonical,
        type: "website"
      }
    };
  }

  const summary = await getAnalysisThemeSummary(slug);

  return {
    title: summary
      ? `${summary.spec.title} | University AI Policy Tracker`
      : "Analysis page not found",
    description: summary?.spec.description ?? "Analysis page not found.",
    alternates: { canonical },
    openGraph: {
      title: summary?.spec.title ?? "Analysis page not found",
      description: summary?.spec.description ?? "Analysis page not found.",
      url: canonical,
      type: "website"
    }
  };
}

export default async function AnalysisRoutePage({ params }: AnalysisRouteProps) {
  const { slug } = await params;

  if (slug === "policy-coverage") {
    return <PolicyCoveragePage />;
  }

  const summary = await getAnalysisThemeSummary(slug);
  if (!summary || summary.evidenceBackedCount < 5) notFound();

  const canonical = getAbsoluteSiteUrl(`/analysis/${slug}`);
  const citationReadySummary = buildAnalysisCitationReadySummary({
    label: summary.spec.summaryLabel,
    profileCount: summary.rows.length,
    evidenceBackedCount: summary.evidenceBackedCount,
    statusCounts: summary.statusCounts
  });

  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: summary.spec.title,
          description: summary.spec.description,
          url: canonical,
          isPartOf: {
            "@type": "WebSite",
            name: "University AI Policy Tracker",
            url: getAbsoluteSiteUrl("/")
          },
          mainEntity: {
            "@type": "ItemList",
            name: `${summary.spec.label} analysis records`,
            numberOfItems: summary.rows.length,
            itemListElement: summary.rows.slice(0, 50).map((row, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: row.profile.canonicalUrl,
              name: row.profile.entityName
            }))
          }
        }}
      />

      <section className="hero">
        <p className="kicker">Theme analysis</p>
        <h1>{summary.spec.title}</h1>
        <p className="lead">
          {summary.spec.description} Each row is derived from the public
          claim/evidence contract and keeps review state, confidence, evidence
          count, source count, and public JSON visible.
        </p>
        <div className="tag-row hero-meta">
          <MetaLabel label="Profiles">{summary.rows.length}</MetaLabel>
          <MetaLabel label="Evidence-backed">
            {summary.evidenceBackedCount}
          </MetaLabel>
          <StateLabel reviewState="machine_candidate" />
          <MetaLabel label="Canonical">{`/analysis/${summary.spec.slug}`}</MetaLabel>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Theme status distribution">
        {summary.statusCounts.map((bucket) => (
          <div key={bucket.status}>
            <span>{bucket.count}</span>
            <p>{bucket.status.replaceAll("_", " ")}</p>
          </div>
        ))}
      </section>

      <ReferenceBox
        description="Short answer for citation and AI answer engines."
        title="Citation-ready summary"
      >
        <p>{citationReadySummary}</p>
        <p className="notice-card">
          `not_mentioned` is an absence-of-evidence marker for the current
          tracker record. It is not proof that a university has no policy, and it
          is not permission or prohibition.
        </p>
      </ReferenceBox>

      <ReferenceBox
        description="Rows are sorted by evidence count, then status, then institution name."
        title={`${summary.spec.label} records`}
      >
        <div className="reference-table-wrap">
          <table className="reference-table analysis-table">
            <thead>
              <tr>
                <th>University</th>
                <th>Status</th>
                <th>Review</th>
                <th>Evidence</th>
                <th>Sources</th>
                <th>Confidence</th>
                <th>Links</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map(({ dimension, profile }) => (
                <tr key={profile.entitySlug}>
                  <td>
                    <div className="table-record-title">
                      <Link href={`/universities/${profile.entitySlug}`}>
                        {profile.entityName}
                      </Link>
                    </div>
                    <div className="table-record-subtitle">
                      {dimension.summary}
                    </div>
                    {dimension.status === "not_mentioned" ? (
                      <div className="table-record-subtitle">
                        {dimension.notMentionedReason}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <AnalysisStatusLabel prefix="" status={dimension.status} />
                  </td>
                  <td>
                    <StateLabel
                      prefix=""
                      reviewState={dimension.reviewState}
                    />
                  </td>
                  <td>{dimension.evidenceCount}</td>
                  <td>{dimension.sourceCount}</td>
                  <td>{Math.round(dimension.confidence * 100)}%</td>
                  <td>
                    <div className="analysis-link-stack">
                      <Link
                        href={`/universities/${profile.entitySlug}#policy-profile`}
                      >
                        Profile
                      </Link>
                      <a href={profile.publicJsonUrl}>Analysis JSON</a>
                      {dimension.basis[0] ? (
                        <Link
                          href={`/universities/${profile.entitySlug}#claim-${dimension.basis[0].claimId}`}
                        >
                          Claim evidence
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReferenceBox>

      <ReferenceBox
        description="The analysis page exposes derived metadata, not a new legal or academic integrity interpretation."
        title="Reuse boundary"
      >
        <ul className="compact-list">
          <li>{NO_ADVICE_BOUNDARY}</li>
          <li>
            Original-language evidence remains canonical. Translation or display
            text cannot replace the original evidence.
          </li>
          <li>
            Cite both the HTML page and the relevant public JSON. For claim-level
            reuse, retain claim IDs, source URLs, source language, snapshot hash,
            confidence, and review state.
          </li>
        </ul>
      </ReferenceBox>
    </main>
  );
}

async function PolicyCoveragePage() {
  const profiles = getCoverageRows(await getPolicyAnalysisProfiles());
  const canonical = getAbsoluteSiteUrl("/analysis/policy-coverage");
  const coverageScoresPath = `/api/public/${PUBLIC_API_VERSION}/analysis/coverage-scores.json`;
  const broadCoverageCount = profiles.filter(
    (profile) => profile.coverageScore.label === "broad_public_coverage"
  ).length;
  const averageScore =
    profiles.reduce(
      (total, profile) => total + profile.coverageScore.score,
      0
    ) / profiles.length;

  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: "University AI Policy Tracker policy coverage scores",
          description:
            "Coverage scores for source-backed university AI policy analysis profiles.",
          url: canonical,
          license: "https://creativecommons.org/licenses/by/4.0/",
          isAccessibleForFree: true,
          distribution: {
            "@type": "DataDownload",
            name: "Policy coverage scores JSON",
            encodingFormat: "application/json",
            contentUrl: getAbsoluteSiteUrl(coverageScoresPath)
          }
        }}
      />

      <section className="hero">
        <p className="kicker">Coverage score</p>
        <h1>Policy coverage score by university</h1>
        <p className="lead">
          Policy Coverage Score measures how much public, source-backed policy
          coverage is visible in the tracker. It is not a ranking of policy
          quality, strictness, compliance, or safety.
        </p>
        <div className="tag-row hero-meta">
          <MetaLabel label="Profiles">{profiles.length}</MetaLabel>
          <MetaLabel label="Average score">
            {formatCoverageScore(Math.round(averageScore))}
          </MetaLabel>
          <MetaLabel label="Broad coverage">{broadCoverageCount}</MetaLabel>
          <StateLabel reviewState="machine_candidate" />
        </div>
      </section>

      <ReferenceBox
        description="Coverage score is an evidence availability measure."
        title="Citation-ready summary"
      >
        <p>
          As of the current public release, University AI Policy Tracker
          publishes policy coverage scores for {profiles.length} university
          records. The average score is{" "}
          {formatCoverageScore(Math.round(averageScore))}, and{" "}
          {broadCoverageCount} records currently have broad public coverage.
          Scores are machine-candidate derived metadata and should be cited with
          their public JSON and source-backed dimension evidence.
        </p>
        <p className="notice-card">
          Do not describe this table as best AI policy, worst AI policy, most
          compliant, legally safe, or institutionally endorsed.
        </p>
      </ReferenceBox>

      <ReferenceBox
        description="Sorted by coverage score, then evidence count, then university name."
        title="Coverage score table"
        actions={
          <a className="site-action" href={coverageScoresPath}>
            Coverage JSON
          </a>
        }
      >
        <div className="reference-table-wrap">
          <table className="reference-table analysis-table">
            <thead>
              <tr>
                <th>University</th>
                <th>Coverage score</th>
                <th>Coverage label</th>
                <th>Evidence-backed dimensions</th>
                <th>Claims</th>
                <th>Review</th>
                <th>Links</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.entitySlug}>
                  <td>
                    <div className="table-record-title">
                      <Link href={`/universities/${profile.entitySlug}`}>
                        {profile.entityName}
                      </Link>
                    </div>
                    <div className="table-record-subtitle">
                      {profile.coverageScore.limitations[0]}
                    </div>
                  </td>
                  <td>{formatCoverageScore(profile.coverageScore.score)}</td>
                  <td>{profile.coverageScore.label.replaceAll("_", " ")}</td>
                  <td>
                    {
                      profile.dimensions.filter(
                        (dimension) => dimension.evidenceCount > 0
                      ).length
                    }
                    /{profile.dimensions.length}
                  </td>
                  <td>{profile.basedOnClaimIds.length}</td>
                  <td>
                    <StateLabel prefix="" reviewState={profile.reviewState} />
                  </td>
                  <td>
                    <div className="analysis-link-stack">
                      <Link
                        href={`/universities/${profile.entitySlug}#policy-profile`}
                      >
                        Profile
                      </Link>
                      <a href={profile.publicJsonUrl}>Analysis JSON</a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReferenceBox>

      <ReferenceBox
        description="The score is intentionally limited."
        title="Score components and caveats"
      >
        <ul className="compact-list">
          <li>
            Components cover central AI guidance, academic integrity,
            disclosure, coursework, exams, privacy/data entry, approved tools,
            and teaching or research guidance.
          </li>
          <li>
            A missing component means the tracker did not find source-backed
            public evidence for that dimension in the current profile.
          </li>
          <li>{NO_ADVICE_BOUNDARY}</li>
          <li>
            Public JSON:{" "}
            <a href={coverageScoresPath}>{coverageScoresPath}</a>. Tracker
            metadata uses {TRACKER_METADATA_LICENSE}; official source materials
            retain their original rights.
          </li>
        </ul>
      </ReferenceBox>
    </main>
  );
}
