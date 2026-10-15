import {test}from'node:test';import assert from'node:assert/strict';import {readFile}from'node:fs/promises';import {createHash}from'node:crypto';
import {getV6StudentActions}from'../apps/web/lib/policy-v6-student-actions';
import {getPolicyV6Data}from'../apps/web/lib/policy-v6';
process.env.UAPT_V6_PUBLISHED_PAGES='1';process.env.NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES='1';process.env.UAPT_DISABLE_INTERNAL_FETCH='1';
const read=async(p:string)=>JSON.parse(await readFile(p,'utf8'));
test('MIT retains its accepted pilot, with complete original quotations and reviewed action/procedure scope',async()=>{
 const p=await read('data/policy-v6-student-actions.json');assert.deepEqual(Object.keys(p.schools).sort(),['imperial-college-london','massachusetts-institute-of-technology']);
 const data=await getPolicyV6Data('en','massachusetts-institute-of-technology'),g=data.studentActions!;assert(data.studentActionsPilot&&g);
 assert.equal(g.do.length,3);assert.equal(g.dont.length,3);assert.deepEqual(g.procedures.appeal,['mit-fact-01','mit-fact-02']);
 for(const row of Object.values(g.claims)){assert(row.evidence.length);assert(!row.text.includes('all students must disclose'));}
 assert.equal(g.do[0].kind,'site_advice');assert.equal(g.do[1].kind,'source_guidance');assert.equal(g.dont[0].kind,'requirement');
 assert.match(g.dont[0].en,/High Risk/);assert.match(g.dont[1].en,/Medium Risk/);assert.match(g.do[1].en,/academic writing/);
 for(const image of g.images){assert.equal(createHash('sha256').update(await readFile('apps/web/public'+image.src)).digest('hex'),image.sha256);}
 const school=data.schools.find(s=>s.slug===data.currentSlug)!;assert.equal(getV6StudentActions({...school,fingerprint:'changed'}),undefined);
 for(const other of data.schools.filter(s=>s.slug!==data.currentSlug&&s.slug!=='imperial-college-london')){const d=await getPolicyV6Data('en',other.slug);assert.equal(d.studentActionsPilot,undefined);assert.equal(d.studentActions,undefined);}
});
