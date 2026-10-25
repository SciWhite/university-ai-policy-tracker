import test from 'node:test';
import assert from 'node:assert/strict';
import {readPublishedV6} from '../apps/web/lib/policy-v6-published';
import {readV6RecordCorrections, v6CorrectedSummary} from '../apps/web/lib/v6-effective-records';
import {getV6PageInput} from '../apps/web/lib/policy-v6-page-input';
import {acceptV6Release} from '../scripts/lib/v6-release-contract';
import {acceptV6SchoolInput} from '../apps/web/lib/policy-v6-input';
import {sourceHashContract, withSourceHashContract} from '../apps/web/lib/source-hash-contract';
import {universityPolicySeo, universityPolicyStructuredData} from '../apps/web/lib/university-policy-seo';
import {SUPPORTED_LOCALES} from '../apps/web/lib/i18n';
import {getIndexRecoveryPilotLocaleRestriction} from '../apps/web/lib/index-recovery-pilot';
import {packV6Release} from '../scripts/pack-v6-release';
import {mkdtempSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
process.env.UAPT_V6_PUBLISHED_PAGES='1';
process.env.UAPT_DISABLE_INTERNAL_FETCH='1';

test('all published adapters and locales meet the same paired acceptance contract without changing data', () => {
  const pages=readPublishedV6()!, records=readV6RecordCorrections()!;
  const before=JSON.stringify([pages,records]);
  const coverage=acceptV6Release(pages,records);
  assert.equal(coverage.claims,records.summaries.reduce((n,s)=>n+s.claims.length,0));
  const kinds=new Set<string>();
  for(const locale of SUPPORTED_LOCALES) for(const slug of pages.slugs) kinds.add(getV6PageInput(slug,locale).kind);
  assert.deepEqual([...kinds].sort(),['bundle','evidence','record']);
  assert.equal(JSON.stringify([pages,records]),before);
});

test('the shared boundary rejects ambiguous adapters, changed basis and promoted holds',()=>{
  const input=getV6PageInput('ucl','en');
  assert('school' in input);
  const s=v6CorrectedSummary('ucl')!;
  assert.throws(()=>acceptV6SchoolInput({...input,evidence:getV6PageInput('harvard-university','en').evidence},s),/Ambiguous/);
  assert.throws(()=>acceptV6SchoolInput(input,s,'a'.repeat(64)),/fingerprint/);
  const changed=structuredClone(input);changed.school.heldClaims.push({id:s.claims[0].id!,text:'held'});
  assert.throws(()=>acceptV6SchoolInput(changed,s),/Held claim/);
  const pages=JSON.parse(JSON.stringify(readPublishedV6()!)), records=JSON.parse(JSON.stringify(readV6RecordCorrections()!));
  delete pages.locales.zh.views.ucl;
  pages.locales.zh.schools.find((s:{slug:string})=>s.slug==='ucl').fingerprint='0'.repeat(64);
  assert.throws(()=>acceptV6Release(pages,records),/fingerprint/);
});

test('tool rows and locale sets cannot silently disappear during packaging',()=>{
  const pages=JSON.parse(JSON.stringify(readPublishedV6()!)), records=JSON.parse(JSON.stringify(readV6RecordCorrections()!));
  pages.locales.en.localEvidence['harvard-university'].hmsTools.pop();
  assert.throws(()=>acceptV6Release(pages,records),/tool mapping/);
  delete pages.locales.ms;
  assert.throws(()=>acceptV6Release(pages,records),/locale coverage/);
});

test('Cornell hash kinds bind captured text versions; unproven historical versions stay unknown',()=>{
  const summary=v6CorrectedSummary('cornell-university')!;
  const before=JSON.stringify(summary), contract=sourceHashContract(summary);
  assert.equal(contract.sources.length,summary.officialSources.length);
  for(const b of contract.sources){assert.equal(b.hashKind,'extracted_text_utf8');assert.equal(b.snapshotHash,b.textSha256);assert.match(b.rawSha256!,/^[a-f0-9]{64}$/);}
  const past=structuredClone(summary);past.officialSources=[{...past.officialSources[0],snapshotHash:'0'.repeat(64)}];past.claims=[];
  assert.equal(sourceHashContract(past).sources[0].hashKind,'unknown_legacy');
  const response=withSourceHashContract({claims:summary.claims},summary);
  assert.equal(response.claims,summary.claims);assert.equal(JSON.stringify(summary),before);
  assert(!JSON.stringify(contract).includes('.local/'));assert(!JSON.stringify(contract).includes('/Users/'));
});

test('all three presentation kinds share structured data and Chinese metadata; locale restrictions survive',()=>{
  for(const slug of ['harvard-university','ucl','cornell-university']) for(const locale of SUPPORTED_LOCALES){
    const summary=v6CorrectedSummary(slug)!;
    const seo=universityPolicySeo(summary,locale), ld=universityPolicyStructuredData(summary,locale);
    assert.equal(ld['@type'],'WebPage');assert.equal(ld.mainEntity['@type'],'Dataset');
    assert.equal(ld.url,String(seo.alternates.canonical));assert.equal(ld.description,seo.description);
    assert(ld.mainEntity.distribution.contentUrl.endsWith(`/universities/${slug}.json`));
    if(locale==='zh'){assert.match(String(seo.title),/AI (?:使用)?政策/);assert(seo.description.includes('官方来源'));}
  }
  const restriction=getIndexRecoveryPilotLocaleRestriction('harvard-university');
  assert.deepEqual(restriction,['en']);
  assert(!Object.keys(universityPolicySeo(v6CorrectedSummary('harvard-university')!,'zh').alternates.languages??{}).includes('zh'));
});

test('packer rejects an unfrozen manifest before creating output',()=>{
  const dir=mkdtempSync(join(tmpdir(),'uapt-v6-packer-test-'));
  try{const input=join(dir,'input.json'),out=join(dir,'out');writeFileSync(input,'{}\n');assert.throws(()=>packV6Release(input,'0'.repeat(64),out),/input changed/);assert(!existsSync(out));}finally{rmSync(dir,{recursive:true});}
});

test('packaging cannot carry an unapproved or stale snapshot as strong',()=>{
  const pages=JSON.parse(JSON.stringify(readPublishedV6()!)), records=JSON.parse(JSON.stringify(readV6RecordCorrections()!));
  const slug=Object.keys(records.snapshots).find(s=>records.snapshots[s].overallStatus!=='strong')!;
  assert(slug);
  const snapshot=records.snapshots[slug];
  snapshot.overallStatus='strong';
  snapshot.statusReasons=[];
  snapshot.review.reviewState='dual_agent_reviewed';
  snapshot.review.primary.decision='approve';snapshot.review.secondary.decision='approve';
  snapshot.review.agreement='agree';snapshot.basisFingerprint='0'.repeat(64);
  assert.throws(()=>acceptV6Release(pages,records),/snapshot marked strong/);
});

test('registry append preserves old versions and URLs, resolves gaps and refuses conflicting provenance',async()=>{
  const {mergeSourceHashRegistry}=await import('../apps/web/lib/source-hash-registry');
  const old={sourceUrl:'https://example.edu/ai',snapshotHash:'a'.repeat(64),hashKind:'extracted_text_utf8' as const,textSha256:'a'.repeat(64),rawSha256:'b'.repeat(64)};
  const original={schemaVersion:'uapt-source-hash-registry-v1' as const,entries:[old]};
  const next={...old,snapshotHash:'c'.repeat(64),textSha256:'c'.repeat(64),rawSha256:'d'.repeat(64)};
  const registry=mergeSourceHashRegistry(original,[next,{...next,sourceUrl:'https://example.edu/other'}]);
  assert.equal(registry.entries.length,3);assert.deepEqual(registry.entries[0],old);
  assert.deepEqual(mergeSourceHashRegistry(registry,[{sourceUrl:old.sourceUrl,snapshotHash:old.snapshotHash,hashKind:'unknown_legacy',unresolvedReason:'legacy input'}]).entries[0],old);
  assert.throws(()=>mergeSourceHashRegistry(original,[{...old,rawSha256:'e'.repeat(64)}]),/Conflicting/);
  assert.throws(()=>mergeSourceHashRegistry(original,[{...old,hashKind:'raw_captured_bytes',rawSha256:old.snapshotHash}]),/Conflicting/);
  assert.deepEqual(original.entries,[old]);
  const gap={schemaVersion:'uapt-source-hash-registry-v1' as const,entries:[{sourceUrl:old.sourceUrl,snapshotHash:old.snapshotHash,hashKind:'unknown_legacy' as const,unresolvedReason:'pending'}]};
  assert.deepEqual(mergeSourceHashRegistry(gap,[old]).entries,[old]);
});

test('candidate preparation validates full records without granting production packaging approval',()=>{
 const pages=JSON.parse(JSON.stringify(readPublishedV6()!)),records=JSON.parse(JSON.stringify(readV6RecordCorrections()!));
 pages.candidateOnly=true;records.candidateOnly=true;pages.publicationApproved=false;records.publicationApproved=false;
 assert.doesNotThrow(()=>acceptV6Release(pages,records,{candidateOnly:true}));assert.throws(()=>acceptV6Release(pages,records),/Unpaired/);
 pages.publicationApproved=true;records.publicationApproved=true;assert.throws(()=>acceptV6Release(pages,records),/Unpaired/);
});
