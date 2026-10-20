import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {readV6RecordCorrections,readV6RecordCorrectionRevision,v6SummaryAtRevision} from '../apps/web/lib/v6-effective-records';
import {buildPolicyAnalysisProfile} from '../apps/web/lib/policy-analysis';
import {getEntityChangeHistory,getChangeIndexData} from '../apps/web/lib/change-records';
import {v6FrozenHistory} from '../apps/web/lib/v6-history-cache';
import {V6CorrectionDiff} from '../apps/tulsa-zone/components/v6-correction-diff';
import {PolicyV6Sources} from '../apps/web/components/policy-v6-sources';

process.env.UAPT_V6_PUBLISHED_PAGES='1';
const slugs=['princeton-university','university-of-sydney','mcgill-university','universite-psl','university-of-toronto','fudan-university','kcl'];

test('uncertain dimensions score zero while reviewed claims, scope and Analysis review remain unchanged',()=>{
  for(const slug of slugs){
    const record=v6SummaryAtRevision(slug)!;const profile=buildPolicyAnalysisProfile(record);
    assert.equal(profile.reviewState,'machine_candidate');assert.equal(record.reviewState,'agent_reviewed');
    for(const c of profile.coverageScore.components)if(['unclear','not_mentioned','insufficient_public_evidence'].includes(c.status))assert.equal(c.points,0,`${slug}/${c.key}`);
    assert.equal(profile.coverageScore.score,profile.coverageScore.components.reduce((n,c)=>n+c.points,0));
  }
  const profile=buildPolicyAnalysisProfile(v6SummaryAtRevision('fudan-university')!);
  assert.equal(profile.coverageScore.score,90);assert.equal(profile.dimensions.find(d=>d.key==='research_guidance')?.status,'insufficient_public_evidence');
});

test('all declared corrections have readable before/after or held entries; frozen global histories remain intact',async()=>{
  const pkg=readV6RecordCorrectionRevision("qs25-31-v6-r1-20261020")!;const totals=[0,0,0];const index=await getChangeIndexData();
  for(const slug of slugs){
    const changes=pkg.changesBySlug[slug];const ids=[...changes.addedClaimIds,...changes.updatedClaimIds,...changes.heldClaimIds];
    totals[0]+=changes.addedClaimIds.length;totals[1]+=changes.updatedClaimIds.length;totals[2]+=changes.heldClaimIds.length;
    const html=renderToStaticMarkup(V6CorrectionDiff({slug,revision:pkg.revision,locale:'zh'}));
    for(const id of ids)assert.ok(html.includes(`data-correction-claim="${id}"`),id);
    assert.ok(html.includes('修订时间不是大学政策生效日期'));
    const history=await getEntityChangeHistory(slug);assert.ok(history!.record.diffRows.length>0);
    assert.ok(index.data.records.find(r=>r.slug===slug)?.primaryDiff);
    assert.equal(JSON.stringify(history!.releaseRecords.filter(r=>r.releaseId!==pkg.revision)),JSON.stringify(v6FrozenHistory(slug)!.filter(r=>r.releaseId!==pkg.revision)));
    const touched=new Set(history!.record.diffRows.flatMap(row=>[row.oldClaim?.claimId,row.newClaim?.claimId]));
    for(const id of ids)assert.ok(touched.has(id),id);
  }
  assert.deepEqual(totals,[37,60,3]);
});

test('one official source card per URL retains every captured source version',()=>{
  for(const slug of slugs){
    const sources=v6SummaryAtRevision(slug)!.officialSources;
    const html=renderToStaticMarkup(PolicyV6Sources({sources,slug,locale:'zh'}));
    assert.equal((html.match(/class="policy-v6-sourceCard"/g)??[]).length,new Set(sources.map(s=>s.sourceUrl)).size);
    for(const s of sources)assert.ok(html.includes(s.snapshotHash),`${slug}/${s.snapshotHash}`);
  }
});
