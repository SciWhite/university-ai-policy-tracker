import { CitationCopyActions } from "@/components/citation-copy-actions";
import { DocumentLink as Link } from "@/components/document-link";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";

interface EntitySidebarProps {
  canonicalUrl: string;
  citationText: string;
  entitySlug?: string;
  officialSourceCount: number;
  publicJsonUrl: string;
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
  entitySlug,
  officialSourceCount,
  publicJsonUrl
}: EntitySidebarProps) {
  return (
    <aside className="entity-sidebar" aria-label="Record reference details">
      <ReferenceBox id="citation" title="Suggested citation" headingLevel="h3">
        <CitationCopyActions
          canonicalUrl={canonicalUrl}
          citationText={citationText}
          entitySlug={entitySlug}
          publicJsonUrl={publicJsonUrl}
        />
        <ul className="source-list">
          <li>
            <a
              data-analytics-entity-slug={entitySlug}
              data-analytics-event="record_canonical_click"
              href={canonicalUrl}
            >
              Canonical page
            </a>
          </li>
          <li>
            <Link href="/citation">Citation rules</Link>
          </li>
        </ul>
      </ReferenceBox>

      <ReferenceBox id="json" title="Public JSON" headingLevel="h3">
        <ul className="source-list">
          <li>
            <a
              data-analytics-entity-slug={entitySlug}
              data-analytics-event="record_public_json_click"
              href={publicJsonUrl}
            >
              Open public JSON
            </a>
          </li>
          <li>
            <Link href="/datasets">Dataset access</Link>
          </li>
        </ul>
      </ReferenceBox>

      <ReferenceBox title="Official sources" headingLevel="h3">
        <MetaLabel label="Sources">{officialSourceCount}</MetaLabel>
      </ReferenceBox>

      <ReferenceBox title="License and limitations" headingLevel="h3">
        <ul className="source-list">
          <li>
            <Link href="/citation">Citation</Link>
          </li>
          <li>
            <Link href="/methodology">Methodology</Link>
          </li>
          <li>
            <Link href="/review">Review</Link>
          </li>
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
      </ReferenceBox>
    </aside>
  );
}
