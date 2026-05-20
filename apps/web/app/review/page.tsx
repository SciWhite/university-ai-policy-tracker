import { PUBLIC_API_VERSION } from "@uapt/shared";
import { ApiEndpointRow } from "@/components/api-endpoint-row";
import { DataList, DataListRow } from "@/components/data-list";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import {
  buildContributionPolicyData,
  reviewQueues
} from "@/lib/contribution-surfaces";
import {
  analysisPageQualityGates,
  analysisReviewChecklist,
  buildAnalysisReviewWorkflow,
  getAnalysisPageQualityApiPath
} from "@/lib/policy-analysis-pages";
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
  const reviewQueuePath = `/api/public/${PUBLIC_API_VERSION}/review/queue.json`;
  const analysisReviewWorkflow = buildAnalysisReviewWorkflow();
  const analysisPageQualityPath = getAnalysisPageQualityApiPath();

  return (
    <main className="page-shell page-shell--wide">
      <section className="hero">
        <p className="kicker">Review workflow</p>
        <h1>Contribution review before publication</h1>
        <p className="lead">
          Review turns submissions into source-checked tasks before anything can
          affect public claim/evidence records.
        </p>
      </section>

      <ReferenceBox
        description="Page quality does not approve derived analysis."
        id="analysis-review"
        title="Analysis profile review"
        actions={
          <a className="site-action" href={analysisPageQualityPath}>
            Page-quality JSON
          </a>
        }
      >
        <p>{analysisReviewWorkflow.publicationGate}</p>
        <div className="tag-row">
          <MetaLabel label="Queue">
            {analysisReviewWorkflow.reviewQueue}
          </MetaLabel>
          <MetaLabel label="Public mutation">Not allowed</MetaLabel>
          <MetaLabel label="Initial state">machine_candidate</MetaLabel>
        </div>
        <DataList>
          {analysisPageQualityGates.map((gate) => (
            <DataListRow
              key={gate.gateId}
              metadata={<MetaLabel label="Gate">{gate.gateId}</MetaLabel>}
            >
              <h2>{gate.label}</h2>
              <p>{gate.requirement}</p>
            </DataListRow>
          ))}
        </DataList>
        <h2>Reviewer checklist</h2>
        <ul className="compact-list">
          {analysisReviewChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </ReferenceBox>

      <ReferenceBox
        description="Each queue has its own publication gate."
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
        description="Issue intake with publication safeguards."
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
        className="compact-reference-box"
        description="Review state and confidence remain separate."
        title="Publication gates"
      >
        <ol className="compact-list">
          <li>Submission creates a review task, not a canonical fact.</li>
          <li>Source review checks officialness, language, access, and rights.</li>
          <li>Claim/evidence review checks short original-language evidence and attribution.</li>
          <li>Course submissions pass moderation before any course entity can be published.</li>
          <li>Institution corrections preserve audit history and cite supporting sources.</li>
          <li>Only reviewed outputs can graduate into public claim/evidence records.</li>
        </ol>
      </ReferenceBox>

      <ReferenceBox
        description="Read-only metadata for contributors and agents."
        title="Review policy JSON"
      >
        <ApiEndpointRow
          description="Read-only contribution review policy, queue definitions, safeguards, and publication gates."
          label="Contribution review policy"
          path={reviewPolicyPath}
          status="Read-only metadata"
          url={reviewPolicyPath}
        />
        <ApiEndpointRow
          description="Unpromoted staging run queue with validation status, source breadth, detected slugs, and recommended next action."
          label="Review queue"
          path={reviewQueuePath}
          status="Read-only metadata"
          url={reviewQueuePath}
        />
      </ReferenceBox>
    </main>
  );
}
