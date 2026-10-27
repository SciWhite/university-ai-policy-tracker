import {createHash} from 'node:crypto';
import type {UniversityToolRecord} from '@uapt/shared';
import type {LocalV6Bundle} from './policy-v6-bundle';
import {acceptedPresentationEvidence} from './policy-v6-presentation-evidence';

export interface ToolPresentationAcceptance {
  schemaVersion: 'uapt-v6-tool-presentation-acceptance-v1';
  canonicalToolsSha256: string;
  displaySha256: string;
  reviewer: string;
  reviewedAt: string;
  scope: 'presentation_only';
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const toolPresentationHash = (view: LocalV6Bundle) => hash({slug:view.school.slug,tools:view.tools,copy:view.toolDisplayCopy??null});

/** Source-backed display cards may differ from retained API records only after exact independent review. */
export function acceptedToolPresentation(view: LocalV6Bundle, canonical: UniversityToolRecord[]) {
  const receipt = view.toolPresentationAcceptance;
  return Boolean(receipt && acceptedPresentationEvidence(view) &&
    receipt.schemaVersion === 'uapt-v6-tool-presentation-acceptance-v1' && receipt.scope === 'presentation_only' &&
    receipt.canonicalToolsSha256 === hash(canonical) && receipt.displaySha256 === toolPresentationHash(view) &&
    receipt.reviewer && Number.isFinite(Date.parse(receipt.reviewedAt)) &&
    view.tools.every(tool => tool.universitySlug === view.school.slug && tool.evidence.length > 0 &&
      tool.evidence.every(e => /^https?:\/\//.test(e.sourceUrl) && e.evidenceSnippet.trim() &&
        ['agent_reviewed','human_reviewed'].includes(e.reviewState))));
}
