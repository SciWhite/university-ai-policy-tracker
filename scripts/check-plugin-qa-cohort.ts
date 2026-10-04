import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { loadCatalog, topics } from "../apps/mcp/src/catalog";
import { PolicyService } from "../apps/mcp/src/policy";
async function main() {
  const catalog=await loadCatalog("apps/mcp/.runtime-data/catalog.json"),service=new PolicyService(catalog);
  const cohort=JSON.parse(await readFile(".local/plugin-qa/cohort.json","utf8"));
  assert.equal(cohort.releaseId,catalog.releaseId,"QA cohort must match the pinned catalog release");
  const results=[];
  for(const school of cohort.priorityQa) {
    const record=catalog.records.find(r=>r.summary.entity.slug===school.slug)!;
    let aliasesChecked=0;
    for(const alias of [record.summary.entity.name,...record.aliases.slice(0,3)]) {
      const resolution=service.resolve(alias);
      assert.ok(resolution.candidates.some(c=>c.slug===school.slug) || resolution.moreCandidates);
      if(resolution.status==="resolved")assert.equal(resolution.slug,school.slug);
      aliasesChecked++;
    }
    for(const topic of topics) {
      const result=service.policy(school.slug,[topic]); assert.ok("claims" in result);
      for(const claim of result.claims) {
        assert.ok(record.summary.claims.some(c=>c.id===claim.id));assert.ok(claim.officialSourceUrls.length);
        const evidence=service.evidence(school.slug,[claim.id!]);assert.equal(evidence.status,"ok");
      }
    }
    results.push({slug:school.slug,aliasesChecked,topicsChecked:topics.length,automatedQa:"passed",chatgptQa:"pending"});
  }
  await writeFile(".local/plugin-qa/cohort-checks.json",JSON.stringify({releaseId:catalog.releaseId,results},null,2));
  console.log(JSON.stringify({schools:results.length,topics:results.length*topics.length,status:"automated checks passed",chatgptQa:"pending"}));
}
main().catch(()=>{console.error("QA cohort check failed");process.exitCode=1;});
