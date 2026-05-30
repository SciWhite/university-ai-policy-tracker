import { PUBLIC_API_VERSION } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { DataList, DataListRow } from "@/components/data-list";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import {
  buildContributionPolicyData,
  contributionWorkflows
} from "@/lib/contribution-surfaces";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { normalizeLocale } from "@/lib/i18n";
import { getPageCopy } from "@/lib/page-copy";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

interface ContributePageProps {
  params?: Promise<{
    locale?: string;
  }>;
}

export async function generateMetadata({
  params
}: ContributePageProps = {}) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).contribute;
  const alternates = getLocalizedAlternates("/contribute", locale);
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

export default async function ContributePage({ params }: ContributePageProps) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = getPageCopy(locale).contribute;
  const contributionPolicy = buildContributionPolicyData();
  const contributionIndexPath = `/api/public/${PUBLIC_API_VERSION}/contributions/index.json`;
  const reviewPolicyPath = `/api/public/${PUBLIC_API_VERSION}/contributions/review-policy.json`;

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">{copy.kicker}</p>
        <h1>{copy.heading}</h1>
        <p className="lead">{copy.lead}</p>
      </section>

      <ReferenceBox
        description={copy.pathsDescription}
        title={copy.pathsTitle}
      >
        <DataList>
          {contributionWorkflows.map((workflow) => (
            <DataListRow
              actions={
                <a className="site-action" href={workflow.githubIssueUrl}>
                  {copy.openTemplate}
                </a>
              }
              key={workflow.type}
              metadata={
                <>
                  <MetaLabel label={copy.queue}>{workflow.reviewQueue}</MetaLabel>
                  <MetaLabel label={copy.canonicalFact}>{copy.no}</MetaLabel>
                </>
              }
            >
              <h2>{workflow.label}</h2>
              <p>{workflow.description}</p>
            </DataListRow>
          ))}
        </DataList>
      </ReferenceBox>

      <ReferenceBox
        description={copy.boundaryDescription}
        title={copy.boundaryTitle}
      >
        <ul className="compact-list">
          {contributionPolicy.publicationRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <p className="notice-card">
          {copy.notice}
        </p>
      </ReferenceBox>

      <ReferenceBox
        description={copy.courseDescription}
        title={copy.courseTitle}
      >
        <p>{copy.courseText}</p>
        <dl className="source-attribution-row__meta">
          <div>
            <dt>{copy.allowedStart}</dt>
            <dd>{copy.allowedStartValue}</dd>
          </div>
          <div>
            <dt>{copy.initialState}</dt>
            <dd>{copy.initialStateValue}</dd>
          </div>
          <div>
            <dt>{copy.publicationModel}</dt>
            <dd>{copy.publicationModelValue}</dd>
          </div>
        </dl>
      </ReferenceBox>

      <ReferenceBox
        description={copy.apiDescription}
        title={copy.apiTitle}
      >
        <ApiEndpointRow
          description={copy.contributionIndexDescription}
          label={copy.contributionIndex}
          path={contributionIndexPath}
          status={copy.readOnlyMetadata}
          url={contributionIndexPath}
        />
        <ApiEndpointRow
          description={copy.reviewPolicyDescription}
          label={copy.reviewPolicy}
          path={reviewPolicyPath}
          status={copy.readOnlyMetadata}
          url={reviewPolicyPath}
        />
      </ReferenceBox>
    </main>
  );
}
