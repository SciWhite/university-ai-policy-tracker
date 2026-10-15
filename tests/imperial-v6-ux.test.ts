import{test}from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';
import{getPolicyV6Data}from'../apps/web/lib/policy-v6';import{getV6StudentActions}from'../apps/web/lib/policy-v6-student-actions';
process.env.UAPT_V6_PUBLISHED_PAGES='1';process.env.NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES='1';process.env.UAPT_DISABLE_INTERNAL_FETCH='1';
test('Imperial scoped action/readthrough projection preserves MIT and binds exact public evidence without changing policy records',async()=>{
 const registry=JSON.parse(await readFile('data/policy-v6-student-actions.json','utf8')),prior=JSON.parse(execFileSync('git',['show','0a5c4e0a:data/policy-v6-student-actions.json'],{encoding:'utf8'}));assert.deepEqual(registry.schools['massachusetts-institute-of-technology'],prior.schools['massachusetts-institute-of-technology']);
 const data=await getPolicyV6Data('zh','imperial-college-london'),guide=data.studentActions!;assert(guide);assert.equal(guide.experience,'compact_evidence');assert.equal(guide.do.length,3);assert.equal(guide.dont.length,3);
 const school=data.schools.find(s=>s.slug===data.currentSlug)!;assert.deepEqual(Object.keys(guide.topics!).sort(),[...school.topics,...school.additionalTopics].map(t=>t.key).sort());
 assert.match(guide.topics!.exams.zh,/未建立统一/);assert.match(guide.topics!.exams.meaningZh,/不代表允许/);assert.match(guide.topics!.disclosure.zh,/建议.*必须/);
 for(const c of Object.values(guide.claims)){assert(c.evidence.length);assert(!c.basisObjectType);assert(c.summaryZh);}
 for(const image of guide.images)assert.equal(createHash('sha256').update(await readFile('apps/web/public'+image.src)).digest('hex'),image.sha256);
 assert.equal(getV6StudentActions({...school,fingerprint:'different'}),undefined);
 const appeal=guide.claims['clm-imperial-college-london-academic-misconduct-appeals'];assert.match(appeal.text,/ten College working days/);assert.match(appeal.text,/D17/);assert(appeal.evidence.some(e=>e.quote.includes('ten College working days')));
 for(const s of data.schools.filter(s=>!['imperial-college-london','massachusetts-institute-of-technology'].includes(s.slug)))assert(getV6StudentActions(s));
});
