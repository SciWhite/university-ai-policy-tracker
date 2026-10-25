import {createHash} from 'node:crypto';
import {publicEntitySummarySchema, policySnapshotSchema, universityToolRecordSchema} from '@uapt/shared';
import type {PublishedV6Package} from '../../apps/web/lib/policy-v6-published';
import type {V6RecordPackage} from '../../apps/web/lib/v6-effective-records';
import {acceptV6SchoolInput} from '../../apps/web/lib/policy-v6-input';
import {validatePolicySnapshotAgainstPublicData} from '../../apps/web/lib/policy-snapshots';
import {SUPPORTED_LOCALES} from '../../apps/web/lib/i18n';

export function acceptV6Release(pages: PublishedV6Package, records: V6RecordPackage, options: {candidateOnly?:boolean} = {}) {
  const sameSet = (a: string[], b: string[]) => new Set(a).size === a.length && new Set(b).size === b.length && [...a].sort().join(',') === [...b].sort().join(',');
  if (pages.schemaVersion !== 'uapt-v6-published-pages-v1' || records.schemaVersion !== 'uapt-v6-effective-records-v1' || (options.candidateOnly ? pages.candidateOnly!==true || records.candidateOnly!==true || pages.publicationApproved!==false || records.publicationApproved!==false : !pages.publicationApproved || !records.publicationApproved || pages.candidateOnly===true || records.candidateOnly===true) || pages.releaseId !== records.revision) throw Error('Unpaired V6 release identity');
  const scope = [...pages.slugs, ...(pages.v5Slugs ?? [])];
  if (!sameSet(scope, records.summaries.map(s => s.entity.slug)) || !sameSet(Object.keys(pages.locales), [...SUPPORTED_LOCALES])) throw Error('Incomplete V6 school/locale coverage');
  for (const key of ['recordRevisions','toolsBySlug','heldBySlug','historical','changesBySlug'] as const) if (!sameSet(scope, Object.keys(records[key]))) throw Error('Incomplete V6 record surface: ' + key);
  for (const slug of Object.keys(records.snapshots)) if (!scope.includes(slug)) throw Error('Orphan V6 snapshot');
  for (const s of records.summaries) {
    publicEntitySummarySchema.parse(s);
    const slug = s.entity.slug;
    const fingerprint = createHash('sha256').update(JSON.stringify(s)).digest('hex');
    if (records.recordRevisions[slug].recordSha256 !== fingerprint) throw Error('Record fingerprint drift: ' + slug);
    const held = records.heldBySlug[slug];
    if (held.some(c => s.claims.some(current => current.id === c.id))) throw Error('Held record promoted: ' + slug);
    records.toolsBySlug[slug].forEach(t => universityToolRecordSchema.parse(t));
    const snapshot = records.snapshots[slug];
    if (snapshot) {
      policySnapshotSchema.parse(snapshot);
      const validation = validatePolicySnapshotAgainstPublicData(snapshot, s, records.datasetReleaseId);
      if (snapshot.overallStatus === 'strong' && validation.effectiveStatus !== 'strong') throw Error('Stale or held V6 snapshot marked strong: ' + slug);
    }
    if (!pages.slugs.includes(slug)) continue; // Historical V5 has a separate presentation contract.
    for (const locale of SUPPORTED_LOCALES) {
      const data = pages.locales[locale];
      if (!sameSet(pages.slugs, data.schools.map(school => school.slug)) || [...Object.keys(data.views), ...Object.keys(data.localEvidence)].some(key => !pages.slugs.includes(key))) throw Error('V6 locale adapter scope drift: ' + locale);
      const school = data.schools.find(school => school.slug === slug)!;
      acceptV6SchoolInput({school, bundle: data.views[slug], evidence: data.localEvidence[slug]}, s, fingerprint);
      const adapterTools = data.views[slug]?.tools ?? data.localEvidence[slug]?.tools;
      if (adapterTools) {
        // relationship is a presentation-only directory label; source-bearing fields must match.
        const canonical = records.toolsBySlug[slug];
        const stripped = adapterTools.map(tool => {
          const {relationship, ...base} = tool as typeof tool & {relationship?: string};
          if (relationship && relationship !== 'institutional_directory') throw Error('Unsupported tool presentation relationship');
          return base;
        });
        const rows = data.localEvidence[slug]?.hmsTools ?? [];
        const sameTool = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
        const inCards = (tool: typeof canonical[number]) => stripped.some(t => sameTool(t, tool));
        const rowMatches = (row: typeof rows[number], tool: typeof canonical[number]) => tool.evidence.some(e => e.sourceUrl === row.sourceUrl && e.evidenceSnippet === row.originalTableRow);
        const extraCard = stripped.some(tool => !canonical.some(t => sameTool(t, tool)));
        const missingTool = canonical.some(tool => !inCards(tool) && !rows.some(row => rowMatches(row, tool)));
        const unboundRow = rows.some(row => !s.claims.some(c => c.id === row.claimId) || !canonical.some(tool => rowMatches(row, tool)));
        if (extraCard || missingTool || unboundRow) throw Error('V6 tool mapping drift: ' + slug);
      }
      if (!sameSet(school.heldClaims.map(c => c.id), held.map(c => c.id!))) throw Error('V6 held mapping drift: ' + slug);
    }
  }
  return {slugs: scope, locales: [...SUPPORTED_LOCALES], claims: records.summaries.reduce((n,s) => n+s.claims.length,0), tools: Object.values(records.toolsBySlug).reduce((n,t) => n+t.length,0), held: Object.values(records.heldBySlug).reduce((n,t) => n+t.length,0)};
}
