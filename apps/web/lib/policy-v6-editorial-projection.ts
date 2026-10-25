import {createHash} from 'node:crypto';
import {getLocalV6StudentActions, type LocalV6Bundle} from './policy-v6-bundle';

export interface V6EditorialProjection {
  schemaVersion: 'uapt-v6-editorial-projection-v1';
  canonicalRecordSha256: string;
  contentSha256: string;
  reviewState: 'pending_independent_presentation_review' | 'accepted_presentation';
  acceptance?: {
    contentSha256: string;
    reviewer: string;
    reviewedAt: string;
    scope: 'presentation_only';
  };
  researchApprovalGranted: false;
  publicationApprovalGranted: false;
}

export function editorialContentHash(view: LocalV6Bundle) {
  return createHash('sha256').update(JSON.stringify({
    slug: view.school.slug,
    recordSha256: view.school.fingerprint,
    topicSummaries: view.topicSummaries,
    topicScopes: view.topicScopes,
    studentActions: view.studentActions,
  })).digest('hex');
}

/** Local inspection of a proposal never supplies independent presentation acceptance. */
export function validateV6EditorialProjection(view: LocalV6Bundle) {
  const projection = view.editorialProjection;
  if (!projection) throw Error('Student guide lacks editorial evidence/review binding');
  if (projection.schemaVersion !== 'uapt-v6-editorial-projection-v1' ||
      projection.canonicalRecordSha256 !== view.school.fingerprint ||
      projection.contentSha256 !== editorialContentHash(view) ||
      projection.researchApprovalGranted !== false ||
      projection.publicationApprovalGranted !== false ||
      !getLocalV6StudentActions(view)) {
    throw Error('Editorial projection identity/evidence drift');
  }
  const topics = [...view.school.topics, ...view.school.additionalTopics];
  if (topics.length !== 9 || topics.some(topic =>
    !view.topicSummaries?.[topic.key]?.en ||
    !/[\u3400-\u9fff]/.test(view.topicSummaries?.[topic.key]?.zh ?? ''))) {
    throw Error('Nine bilingual editorial summaries required');
  }
  const guide = view.studentActions!;
  if (!guide.do.length || !guide.dont.length) throw Error('Bound Do/Don’t content missing');
  if (projection.reviewState === 'pending_independent_presentation_review') {
    if (view.candidateOnly !== true || view.publicationApproved !== false || projection.acceptance) {
      throw Error('Unaccepted presentation entered release');
    }
  } else if (projection.reviewState === 'accepted_presentation') {
    const receipt = projection.acceptance;
    if (!receipt || receipt.contentSha256 !== projection.contentSha256 || !receipt.reviewer ||
        !Number.isFinite(Date.parse(receipt.reviewedAt)) || receipt.scope !== 'presentation_only') {
      throw Error('Missing independent exact-content presentation acceptance');
    }
  } else {
    throw Error('Unknown editorial review state');
  }
}
