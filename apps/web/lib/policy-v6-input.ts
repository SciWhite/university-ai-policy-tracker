import {validateV6EditorialProjection} from './policy-v6-editorial-projection';
import {validatePublicClaimDispositions} from './policy-v6-claim-disposition';
import type {PublicEntitySummary} from '@uapt/shared';
import type {LabSchool} from './policy-v6';
import type {LocalV6Bundle} from './policy-v6-bundle';
import type {LocalV6Evidence} from './policy-v6-local-evidence';
import {validateV6Completeness} from './policy-v6-completeness';
import type {SupportedLocale} from './i18n';

/** A single adapter boundary. These are presentations, not additional approvals. */
export interface V6SchoolInput {
  school: LabSchool;
  bundle?: LocalV6Bundle;
  evidence?: LocalV6Evidence;
}
export type AcceptedV6Input = V6SchoolInput & {kind: 'record' | 'bundle' | 'evidence'};
const coreTopics = 'coursework,exams,disclosure,privacy_data,approved_tools,research_publication';
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const unique = (ids: (string | undefined)[]) => ids.every(Boolean) && new Set(ids).size === ids.length;

/** Used by both packing and rendering; never mutates evidence or promotes a hold. */
export function acceptV6SchoolInput(input: V6SchoolInput, summary?: PublicEntitySummary, fingerprint?: string, presentation?: {locale:SupportedLocale;allowFrozenLegacy?:boolean}): AcceptedV6Input {
  const {school, bundle, evidence} = input;
  if (!school || !/^[a-z0-9-]+$/.test(school.slug) || !/^[a-f0-9]{64}$/.test(school.fingerprint) || !school.revision || (bundle && evidence)) throw Error('Ambiguous/invalid V6 school input');
  const topics = [...school.topics, ...school.additionalTopics];
  if (school.topics.map(t => t.key).join(',') !== coreTopics || !unique(topics.map(t => t.key))) throw Error('Invalid V6 topic coverage: ' + school.slug);
  for (const topic of topics) {
    if (!topic.summary || (!topic.claims.length && !['not_mentioned','insufficient_public_evidence','unclear'].includes(topic.status)) || topic.claims.some(c => !c.evidence.length || c.evidence.some(e => !e.quote || !/^https?:\/\//.test(e.url)))) throw Error('Missing V6 topic evidence: ' + school.slug);
  }
  const claims = bundle?.claims ?? evidence?.record.claims ?? summary?.claims;
  if (claims && (!unique(claims.map(c => c.id)) || claims.some(c => c.entitySlug !== school.slug || !['agent_reviewed','human_reviewed'].includes(c.reviewState)))) throw Error('Invalid V6 reviewed Claim ID set: ' + school.slug);
  if (summary && (summary.entity.slug !== school.slug || (claims && !same(claims, summary.claims)))) throw Error('V6 presentation/public record mismatch: ' + school.slug);
  if (fingerprint && school.fingerprint !== fingerprint) throw Error('V6 record fingerprint mismatch: ' + school.slug);
  const displayed = new Set(claims?.map(c => c.id));
  if (school.heldClaims.some(c => displayed.has(c.id)) || bundle?.heldDraftIds?.some(id => displayed.has(id))) throw Error('Held claim entered V6 conclusions: ' + school.slug);
  if (bundle && (!same(bundle.school, school) || (summary && !same(bundle.sources, summary.officialSources)))) throw Error('V6 bundle mapping drift: ' + school.slug);
  if (evidence && (evidence.record.entity.slug !== school.slug || evidence.fingerprint !== school.fingerprint || (summary && !same(evidence.record, summary)))) throw Error('V6 evidence mapping drift: ' + school.slug);
  if(bundle){validatePublicClaimDispositions(bundle);if(bundle.claimDispositions)validateV6EditorialProjection(bundle);}
  if(presentation)validateV6Completeness(input,presentation.locale,presentation.allowFrozenLegacy??true);
  return {...input, kind: bundle ? 'bundle' : evidence ? 'evidence' : 'record'};
}
