import { PUBLIC_API_VERSION } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { DataList, DataListRow } from "@/components/data-list";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import {
  buildContributionPolicyData,
  reviewQueues
} from "@/lib/contribution-surfaces";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "Review Workflow | University AI Policy Tracker";
const description =
  "Public review workflow for contribution tasks, institution corrections, course-level submissions, source evidence, translation corrections, and moderation boundaries.";

export function generateMetadata() {
  const canonical = getAbsoluteSiteUrl("/review");

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

export default function ReviewWorkflowPage() {
  const contributionPolicy = buildContributionPolicyData();
  const reviewPolicyPath = `/api/public/${PUBLIC_API_VERSION}/contributions/review-policy.json`;

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">Review workflow</p>
        <h1>Contribution review before publication</h1>
        <p className="lead">
          Review keeps the public database useful without letting submissions
          become unsupported facts. Every contribution is evaluated for source
          provenance, source language, evidence, rights, privacy, moderation
          risk, and consistency with the claim/evidence contract.
        </p>
      </section>

      <ReferenceBox
        description="Each queue has a different publication gate. Passing a queue does not bypass source evidence or review-state labeling."
        title="Review queues"
      >
        <DataList>
          {reviewQueues.map((queue) => (
            <DataListRow
              key={queue.queue}
              metadata={<MetaLabel label="Queue">{queue.queue}</MetaLabel>}
            >
              <h2>{queue.label}</h2>
              <p>{queue.purpose}</p>
              <p className="muted">{queue.publicationGate}</p>
            </DataListRow>
          ))}
        </DataList>
      </ReferenceBox>

      <ReferenceBox
        description="The first review layer is intentionally stricter than a normal issue tracker."
        title="Safeguards"
      >
        <div className="detail-grid">
          <article className="policy-card">
            <h3>Privacy</h3>
            <ul className="compact-list">
              {contributionPolicy.privacyRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </article>
          <article className="policy-card">
            <h3>Copyright</h3>
            <ul className="compact-list">
              {contributionPolicy.copyrightRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </article>
          <article className="policy-card">
            <h3>Moderation</h3>
            <ul className="compact-list">
              {contributionPolicy.moderationRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </article>
        </div>
      </ReferenceBox>

      <ReferenceBox
        description="Review state and confidence remain separate in every contribution path."
        title="Publication gates"
      >
        <ol className="compact-list">
          <li>Submission creates a review task, not a canonical fact.</li>
          <li>Source review checks officialness, source language, accessibility, and rights caveats.</li>
          <li>Claim/evidence review checks short original-language evidence and attribution.</li>
          <li>Course submissions pass moderation before any course entity can be published.</li>
          <li>Institution corrections preserve audit history and cite supporting sources.</li>
          <li>Only reviewed outputs can graduate into public claim/evidence records.</li>
        </ol>
      </ReferenceBox>

      <ReferenceBox
        description="This endpoint is metadata for contributors and agents. It is not a write API."
        title="Review policy JSON"
      >
        <ApiEndpointRow
          description="Read-only contribution review policy, queue definitions, safeguards, and publication gates."
          label="Contribution review policy"
          path={reviewPolicyPath}
          status="Read-only metadata"
          url={reviewPolicyPath}
        />
      </ReferenceBox>
    </main>
  );
}
