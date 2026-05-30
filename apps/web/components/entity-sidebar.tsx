import { CitationCopyActions } from "@/components/citation-copy-actions";
import { DocumentLink as Link } from "@/components/document-link";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";

interface EntitySidebarProps {
  canonicalUrl: string;
  citationText: string;
  license: string;
  limitations: readonly string[];
  officialSourceCount: number;
  publicJsonUrl: string;
  sourceRightsPolicy: string;
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
  license,
  limitations,
  officialSourceCount,
  publicJsonUrl,
  sourceRightsPolicy
}: EntitySidebarProps) {
  return (
    <aside className="entity-sidebar" aria-label="Record reference details">
      <ReferenceBox id="citation" title="Suggested citation" headingLevel="h3">
        <p>{citationText}</p>
        <CitationCopyActions
          canonicalUrl={canonicalUrl}
          citationText={citationText}
          publicJsonUrl={publicJsonUrl}
        />
        <ul className="source-list">
          <li>
            <a href={canonicalUrl}>Canonical page</a>
          </li>
          <li>
            <Link href="/citation">Citation rules</Link>
          </li>
        </ul>
      </ReferenceBox>

      <ReferenceBox id="json" title="Public JSON" headingLevel="h3">
        <p>
          Versioned university record with claims, evidence, source attribution,
          review state, confidence, and citation fields.
        </p>
        <ul className="source-list">
          <li>
            <a href={publicJsonUrl}>Open public JSON</a>
          </li>
          <li>
            <Link href="/datasets">Dataset access</Link>
          </li>
        </ul>
      </ReferenceBox>

      <ReferenceBox title="Official sources" headingLevel="h3">
        <p>{officialSourceCount} source attribution record.</p>
        <p className="muted">{sourceRightsPolicy}</p>
      </ReferenceBox>

      <ReferenceBox title="License and limitations" headingLevel="h3">
        <p>Tracker metadata: {license}</p>
        <ul className="compact-list">
          {limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </ReferenceBox>

      <ReferenceBox title="Review states" headingLevel="h3">
        <ul className="review-state-list">
          {reviewStates.map((reviewState) => (
            <li key={reviewState}>
              <StateLabel prefix="" reviewState={reviewState} />
            </li>
          ))}
        </ul>
        <p className="muted">
          Review state describes workflow status. Confidence is a separate
          machine-assessed support score.
        </p>
      </ReferenceBox>
    </aside>
  );
}
