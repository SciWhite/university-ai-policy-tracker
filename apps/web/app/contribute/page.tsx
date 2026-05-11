import { PUBLIC_API_VERSION } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { DataList, DataListRow } from "@/components/data-list";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import {
  buildContributionPolicyData,
  contributionWorkflows
} from "@/lib/contribution-surfaces";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "Contribute | University AI Policy Tracker";
const description =
  "Submit official university AI policy sources, corrections, course-level AI policy evidence, translation fixes, and dataset issues into a review-task workflow.";

export function generateMetadata() {
  const canonical = getAbsoluteSiteUrl("/contribute");

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

export default function ContributePage() {
  const contributionPolicy = buildContributionPolicyData();
  const contributionIndexPath = `/api/public/${PUBLIC_API_VERSION}/contributions/index.json`;
  const reviewPolicyPath = `/api/public/${PUBLIC_API_VERSION}/contributions/review-policy.json`;

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">Contribution intake</p>
        <h1>Submit evidence into a review queue</h1>
        <p className="lead">
          Contributions help expand coverage, but they do not create canonical
          policy facts directly. Every source URL, correction, translation fix,
          or course-level submission starts as a review task with privacy,
          copyright, source-language, and evidence checks.
        </p>
      </section>

      <ReferenceBox
        description="The first live intake channel is GitHub issue templates, so submissions are visible, auditable, and reviewable before publication."
        title="Contribution paths"
      >
        <DataList>
          {contributionWorkflows.map((workflow) => (
            <DataListRow
              actions={
                <a className="site-action" href={workflow.githubIssueUrl}>
                  Open template
                </a>
              }
              key={workflow.type}
              metadata={
                <>
                  <MetaLabel label="Queue">{workflow.reviewQueue}</MetaLabel>
                  <MetaLabel label="Canonical fact">No</MetaLabel>
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
        description="This is the publication boundary for all contribution types."
        title="What a submission can and cannot do"
      >
        <ul className="compact-list">
          {contributionPolicy.publicationRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <p className="notice-card">
          The tracker is not legal advice, not academic integrity advice, and
          not an official university statement unless a linked source is the
          university&apos;s own official page.
        </p>
      </ReferenceBox>

      <ReferenceBox
        description="Course-level policy submissions are useful, but they are handled as evidence records, not as open comments."
        title="Course-level submissions"
      >
        <p>
          Course records must reuse the same claim/evidence structure as
          university records: entity, term, source type, claim, original-language
          evidence, source language, review state, and moderation status. Do not
          paste full syllabi, LMS content, private student information, or
          non-public instructor data.
        </p>
        <dl className="source-attribution-row__meta">
          <div>
            <dt>Allowed starting point</dt>
            <dd>Short excerpt or public syllabus URL for review</dd>
          </div>
          <div>
            <dt>Initial state</dt>
            <dd>pending review task, not a public claim</dd>
          </div>
          <div>
            <dt>Publication model</dt>
            <dd>claim/evidence after moderation and rights review</dd>
          </div>
        </dl>
      </ReferenceBox>

      <ReferenceBox
        description="Machine-readable intake policy for agents, developers, and contributors."
        title="Contribution API metadata"
      >
        <ApiEndpointRow
          description="Contribution workflows, required fields, GitHub issue template URLs, safeguards, and publication rules."
          label="Contribution index"
          path={contributionIndexPath}
          status="Read-only metadata"
          url={contributionIndexPath}
        />
        <ApiEndpointRow
          description="Review queues, publication gates, moderation rules, and contribution review boundaries."
          label="Review policy"
          path={reviewPolicyPath}
          status="Read-only metadata"
          url={reviewPolicyPath}
        />
      </ReferenceBox>
    </main>
  );
}
