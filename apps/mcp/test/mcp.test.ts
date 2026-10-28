import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { loadCatalog, digest, eligibleClaims } from "../src/catalog.js";
import { PolicyService } from "../src/policy.js";
import { DailyTelemetry, retentionCutoff } from "../src/telemetry.js";
import { createMcpHttpServer } from "../src/server.js";
import { evidenceOutput, policyOutput } from "../src/output-schemas.js";

const file = path.resolve(import.meta.dirname,"../.runtime-data/catalog.json");
test("standard MCP clients accept original bracketed source URLs without rewriting evidence", async () => {
  const catalog = await loadCatalog(file);
  const p = new PolicyService(catalog);
  const record = catalog.records.find(r => r.summary.entity.slug === "technical-university-of-munich")!;
  const claim = record.summary.claims.find(c => c.evidence.some(e => e.sourceUrl.includes("[action]")))!;
  assert.ok(claim);
  const http = createMcpHttpServer(p, new DailyTelemetry());
  await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
  const address = http.address(); assert.ok(address && typeof address !== "string");
  const client = new Client({name: "uapt-original-source-url-regression", version: "1.0.0"});
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/api/mcp`)));
    const response = await client.callTool({name: "get_student_policy", arguments: {slug: record.summary.entity.slug}});
    assert.ok(!response.isError);
    const evidence = await client.callTool({name: "get_policy_evidence", arguments: {slug: record.summary.entity.slug, claim_ids: [claim.id]}});
    const result = evidence.structuredContent as {claims: typeof record.summary.claims};
    assert.deepEqual(result.claims[0].evidence, claim.evidence);
    const invalidPolicy = structuredClone(p.policy(record.summary.entity.slug));
    assert.ok("claims" in invalidPolicy);
    invalidPolicy.claims![0].officialSourceUrls = ["not-a-url"];
    assert.equal(policyOutput.safeParse(invalidPolicy).success, false);
    const invalidEvidence = structuredClone(p.evidence(record.summary.entity.slug, [claim.id!]));
    invalidEvidence.claims[0].evidence[0].sourceUrl = "https://";
    assert.equal(evidenceOutput.safeParse(invalidEvidence).success, false);
  } finally { await client.close(); await new Promise<void>(resolve => http.close(() => resolve())); }
});
test("catalog contains only published reviewed, attributable evidence", async () => {
  const c = await loadCatalog(file);
  assert.ok(c.records.length > 800, "All eligible published universities, not a top-100 whitelist");
  for (const r of c.records) {
    assert.equal(r.summary.canonicalUrl,`https://eduaipolicy.org/universities/${r.summary.entity.slug}`);
    assert.equal(r.summary.apiUrl,`https://eduaipolicy.org/api/public/v1/universities/${r.summary.entity.slug}.json`);
    assert.equal(eligibleClaims(r).length,r.summary.claims.length);
    for (const claim of r.summary.claims) { assert.ok(claim.id); assert.ok(claim.evidence.every(e => e.sourceSnapshotHash === e.attribution.snapshotHash)); }
    if (r.snapshot) { assert.equal(r.snapshot.releaseId,c.releaseId); assert.equal(r.snapshot.overallStatus,"strong"); }
  }
});
test("digest corruption and unreviewed publication are rejected", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(),"uapt-catalog-"));
  const envelope=JSON.parse(await readFile(file,"utf8"));
  envelope.sha256="invalid"; await writeFile(path.join(dir,"bad.json"),JSON.stringify(envelope));
  await assert.rejects(loadCatalog(path.join(dir,"bad.json")),/digest/);
  envelope.payload.records[0].summary.claims[0].reviewState="machine_candidate";
  envelope.sha256=digest(envelope.payload); await writeFile(path.join(dir,"bad.json"),JSON.stringify(envelope));
  await assert.rejects(loadCatalog(path.join(dir,"bad.json")),/Ineligible/);
});
test("stale fingerprints and mismatched school identity fail closed", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(),"uapt-pin-"));
  const envelope = JSON.parse(await readFile(file,"utf8"));
  const strong = envelope.payload.records.find((r: {snapshot?:unknown}) => r.snapshot);
  assert.ok(strong);
  strong.snapshot.basisFingerprint = "0".repeat(64);
  envelope.sha256 = digest(envelope.payload);
  await writeFile(path.join(dir,"stale.json"),JSON.stringify(envelope));
  await assert.rejects(loadCatalog(path.join(dir,"stale.json")),/fingerprint/);
  const mismatch = JSON.parse(await readFile(file,"utf8"));
  mismatch.payload.records[0].summary.entitySlug = "different-school";
  mismatch.sha256 = digest(mismatch.payload);
  await writeFile(path.join(dir,"mismatch.json"),JSON.stringify(mismatch));
  await assert.rejects(loadCatalog(path.join(dir,"mismatch.json")),/university/);
  mismatch.payload.publicationState = "candidate";
  mismatch.sha256 = digest(mismatch.payload);
  await writeFile(path.join(dir,"candidate.json"),JSON.stringify(mismatch));
  await assert.rejects(loadCatalog(path.join(dir,"candidate.json")));
});
test("published correction metadata and held claims fail closed after envelope rehash", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "uapt-corrected-"));
  const envelope = JSON.parse(await readFile(file, "utf8"));
  const target = envelope.payload.records.find((r: {universityRevisionId?:string}) => r.universityRevisionId);
  assert.ok(target, "Exporter must retain published correction metadata");
  target.summary.claims[0].claimText += " altered";
  envelope.sha256 = digest(envelope.payload);
  await writeFile(path.join(dir, "bad.json"), JSON.stringify(envelope));
  await assert.rejects(loadCatalog(path.join(dir, "bad.json")), /fingerprint/);
  target.recordSha256 = digest(target.summary);
  target.summarySha256 = digest(target.summary);
  target.historicalClaimIds = [target.summary.claims[0].id];
  envelope.sha256 = digest(envelope.payload);
  await writeFile(path.join(dir, "bad.json"), JSON.stringify(envelope));
  await assert.rejects(loadCatalog(path.join(dir, "bad.json")), /Held claim/);
});
test("entity aliases, ambiguous names and private candidate exclusion", async () => {
  const catalog=await loadCatalog(file); const p = new PolicyService(catalog);
  const record=catalog.records.find(r=>r.summary.entity.slug==="national-university-of-singapore")!;
  assert.equal(p.resolve("NUS").slug,record.summary.entity.slug);
  assert.equal(p.resolve("made up school zzxx").status,"not_found");
  const other=structuredClone(record); other.summary.entity.slug="another-school";
  const ambiguous = new PolicyService({...catalog, records:[record,other]});
  assert.equal(ambiguous.resolve("NUS").status,"ambiguous");
  assert.equal(ambiguous.resolve("NUS").slug,undefined);
  assert.equal(p.policy("private-candidate-university").status,"not_found");
});
test("unsupported topics and foreign claim IDs do not create conclusions", async () => {
  const catalog=await loadCatalog(file); const record=catalog.records[0];
  const p = new PolicyService({...catalog, records:[{...record, snapshot:undefined, summary:{...record.summary,claims:record.summary.claims.map(c=>({...c,claimType:"other",claimText:"An institutional document is available."}))}}]});
  const response = p.policy(record.summary.entity.slug,["ai_detection"]);
  assert.equal(response.status,"insufficient_evidence");
  assert.ok("insufficientTopics" in response);
  assert.deepEqual(response.insufficientTopics,["ai_detection"]);
  assert.equal(response.claims?.length,0);
  assert.equal(p.evidence(record.summary.entity.slug,["claim-from-another-university"]).claims.length,0);
});
test("focused topics retain CLIE assessment exceptions and Waterloo instructor restrictions", async () => {
  const p = new PolicyService(await loadCatalog(file));
  const exams = p.policy("ucl",["exams"]);
  assert.ok("claims" in exams);
  assert.ok(exams.claims?.some(c=>c.id==="clm-ucl-clie-genai-assessment-2026-27"));
  const coursework = p.policy("university-of-waterloo",["coursework"]);
  assert.ok("claims" in coursework);
  for (const id of ["claim-waterloo-ai-instructor-rules","claim-waterloo-grad-genai-permission","claim-waterloo-course-outline-permitted-use"]) {
    assert.ok(coursework.claims?.some(c=>c.id===id),id);
  }
});
test("policy conditions precede tool entries without losing claims or mutating the catalog", async () => {
  const catalog=await loadCatalog(file); const p=new PolicyService(catalog);
  for (const [slug,restriction] of [
    ["university-of-toronto","draft-claim-uoft-course-materials-upload"],
    ["princeton-university","draft-claim-princeton-art-archaeology-independent-work"]
  ]) {
    const record=catalog.records.find(r=>r.summary.entity.slug===slug)!;
    const original=JSON.stringify(record);
    const response=p.policy(slug);
    assert.ok("claims" in response);
    assert.ok(response.claims?.some(c=>c.id===restriction),restriction);
    assert.ok(response.claims!.length<=15);
    assert.deepEqual(new Set([...response.claims!.map(c=>c.id),...response.remainingClaimIds!]),new Set(record.summary.claims.map(c=>c.id)));
    assert.deepEqual(response.tools,record.tools);
    assert.equal(JSON.stringify(record),original);
  }
});
test("remaining claims have a bounded evidence continuation with complete original text", async () => {
  const catalog=await loadCatalog(file); const p=new PolicyService(catalog);
  const response=p.policy("university-of-toronto");
  assert.ok("remainingClaimIds" in response);
  assert.ok(response.remainingClaimIds!.length>0);
  assert.ok(response.limitations.some(l=>l.includes("get_policy_evidence") && l.includes("at most 10")));
  const remaining=response.remainingClaimIds!;
  const recovered=[];
  for (let start=0;start<remaining.length;start+=10) {
    const evidence=p.evidence("university-of-toronto",remaining.slice(start,start+10));
    assert.equal(evidence.status,"ok");
    assert.ok("missingClaimIds" in evidence);
    assert.deepEqual(evidence.missingClaimIds,[]);
    recovered.push(...evidence.claims);
  }
  assert.deepEqual(new Set(recovered.map(c=>c.id)),new Set(remaining));
  const record=catalog.records.find(r=>r.summary.entity.slug==="university-of-toronto")!;
  for (const claim of recovered) {
    const original=record.summary.claims.find(c=>c.id===claim.id)!;
    assert.equal(claim.claimText,original.claimText);
    assert.deepEqual(claim.evidence,original.evidence);
  }
});
test("recorded evidence retains local scope and does not promise live source availability", async () => {
  const catalog=await loadCatalog(file);
  const record=structuredClone(catalog.records.find(r=>r.snapshot)!);
  const scopeLimit="This guidance applies to this faculty's staff, not all student assessments.";
  record.snapshot!.limitations.push(scopeLimit);
  const service=new PolicyService({...catalog,records:[record]});
  for (const response of [service.policy(record.summary.entity.slug),service.evidence(record.summary.entity.slug,[record.summary.claims[0].id!])]) {
    assert.ok(response.limitations.includes(scopeLimit));
    assert.ok(response.limitations.some(l=>l.includes("If a source cannot be opened")));
    assert.ok(response.limitations.some(l=>l.includes("Generic misconduct sanctions do not establish AI-specific penalties")));
  }
});
test("daily aggregation persists no prompts or IDs and purges old days", async () => {
  const dir=await mkdtemp(path.join(os.tmpdir(),"uapt-telemetry-")); const file=path.join(dir,"totals.json");
  await writeFile(file, JSON.stringify({schemaVersion:"uapt-mcp-daily-v1",days:{"2020-01-01":{"old":{calls:1,latencyMsTotal:1,latencyMsMax:1}}}}));
  const t = new DailyTelemetry(file); await t.initialize();
  await Promise.all([t.record("get_student_policy","nus","coursework","ok",10),t.record("get_student_policy","nus","coursework","ok",20)]);
  const result=JSON.parse(await readFile(file,"utf8")); assert.equal(result.days["2020-01-01"],undefined);
  const buckets=Object.values(result.days)[0] as { [key:string]:{ calls:number;latencyMsTotal:number } };
  assert.equal(buckets["get_student_policy|nus|coursework|ok"].calls,2);
  assert.equal(buckets["get_student_policy|nus|coursework|ok"].latencyMsTotal,30);
  assert.equal(retentionCutoff(new Date("2026-03-31T00:00:00Z")).toISOString(),"2025-02-28T00:00:00.000Z");
});
test("real no-auth Streamable HTTP initialize, tools and all three calls", async () => {
  const p=new PolicyService(await loadCatalog(file)); const telemetry=new DailyTelemetry();
  const http = createMcpHttpServer(p,telemetry); await new Promise<void>(r=>http.listen(0,"127.0.0.1",r));
  const address=http.address(); assert.ok(address && typeof address !== "string");
  const endpoint=new URL(`http://127.0.0.1:${address.port}/api/mcp`);
  const client=new Client({name:"uapt-acceptance",version:"1.0.0"});
  try {
    await client.connect(new StreamableHTTPClientTransport(endpoint));
    const listed=await client.listTools(); assert.equal(listed.tools.length,3);
    for(const tool of listed.tools) assert.deepEqual(tool.annotations,{readOnlyHint:true,destructiveHint:false,openWorldHint:false});
    assert.ok((listed.tools.find(t=>t.name==="get_student_policy")?.outputSchema?.properties as {claims?:unknown})?.claims);
    const resolved=await client.callTool({name:"resolve_university",arguments:{name:"NUS"}});
    const data=resolved.structuredContent as {slug:string}; assert.equal(data.slug,"national-university-of-singapore");
    const policy=await client.callTool({name:"get_student_policy",arguments:{slug:data.slug,topics:["coursework"]}});
    const result=policy.structuredContent as {status:string;claims:{id:string;officialSourceUrls:string[]}[];trackerUrl:string};
    assert.equal(result.status,"ok"); assert.ok(result.trackerUrl.startsWith("https://eduaipolicy.org/")); assert.ok(result.claims.length);
    const evidence=await client.callTool({name:"get_policy_evidence",arguments:{slug:data.slug,claim_ids:[result.claims[0].id]}});
    assert.equal((evidence.structuredContent as {status:string}).status,"ok");
    const exams = await client.callTool({name:"get_student_policy",arguments:{slug:"ucl",topics:["exams"]}});
    assert.ok((exams.structuredContent as {claims:{id:string}[]}).claims.some(c => c.id === "clm-ucl-clie-genai-assessment-2026-27"));
    const toronto = await client.callTool({name:"get_student_policy",arguments:{slug:"university-of-toronto"}});
    const corrected = toronto.structuredContent as {claims:{id:string}[];tools:unknown[];universityRevisionId:string;snapshotStatus:string};
    assert.ok(corrected.claims.some(c => c.id === "draft-claim-uoft-course-materials-upload"));
    assert.ok(corrected.tools.length > 0);
    assert.ok(corrected.universityRevisionId);
    assert.equal(corrected.snapshotStatus,"unavailable");
    const invalid=await client.callTool({name:"get_student_policy",arguments:{slug:"../../.local"}}); assert.equal(invalid.isError,true);
    assert.equal((await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Origin:"https://untrusted.example"},body:"{}"})).status,403);
    assert.equal((await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:"{"})).status,400);
    assert.equal((await fetch(endpoint)).status,405);
    assert.equal((await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:"x".repeat(33000)})).status,413);
    const buckets=Object.values(telemetry.snapshot().days)[0];
    assert.equal(buckets["protocol|unresolved|protocol|error"].calls,3);
    p.policy = () => { throw new Error("private assignment content must not be recorded"); };
    const failure=await client.callTool({name:"get_student_policy",arguments:{slug:data.slug}});
    assert.equal(failure.isError,true);
    assert.ok(!JSON.stringify(failure).includes("private assignment content"));
    const totals=telemetry.snapshot();
    assert.ok(!JSON.stringify(totals).includes("private assignment content"));
    assert.equal(Object.values(totals.days)[0][`get_student_policy|${data.slug}|all|error`].calls,1);
  } finally { await client.close(); await new Promise<void>(r=>http.close(()=>r())); }
});

test("presentation exclusions retain original records but never return them as current policy or evidence", async () => {
  const catalog = await loadCatalog(file);
  const record = structuredClone(catalog.records.find(r => r.summary.claims.length >= 2 && !r.snapshot)!);
  assert.ok(record);
  const excluded = record.summary.claims[0].id!;
  const retained = structuredClone(record.summary.claims[0]);
  record.presentationExcludedClaimIds = [excluded];
  const service = new PolicyService({...catalog, records: [record]});
  const policy = service.policy(record.summary.entity.slug);
  assert.ok('claims' in policy && 'remainingClaimIds' in policy && 'presentationExcludedClaimIds' in policy);
  assert.ok(!policy.claims?.some(c => c.id === excluded));
  assert.ok(!policy.remainingClaimIds?.includes(excluded));
  assert.deepEqual(policy.presentationExcludedClaimIds, [excluded]);
  assert.ok(policy.limitations.some(x => x.includes('excluded from current policy guidance')));
  const evidence = service.evidence(record.summary.entity.slug, [excluded]);
  assert.ok('missingClaimIds' in evidence);
  assert.equal(evidence.status, 'insufficient_evidence');
  assert.deepEqual(evidence.missingClaimIds, [excluded]);
  assert.deepEqual(record.summary.claims[0], retained);
});

test("catalog rejects invalid exclusions and snapshots based on excluded claims", async () => {
  const envelope = JSON.parse(await readFile(file, 'utf8'));
  const target = envelope.payload.records.find((r: any) => r.snapshot && r.snapshot.basis.claimIds.length);
  assert.ok(target);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'uapt-exclusions-'));
  const candidate = path.join(dir, 'catalog.json');
  target.presentationExcludedClaimIds = ['not-a-published-claim'];
  envelope.sha256 = digest(envelope.payload);
  await writeFile(candidate, JSON.stringify(envelope));
  await assert.rejects(loadCatalog(candidate), /Invalid presentation exclusion/);
  target.presentationExcludedClaimIds = [target.snapshot.basis.claimIds[0]];
  envelope.sha256 = digest(envelope.payload);
  await writeFile(candidate, JSON.stringify(envelope));
  await assert.rejects(loadCatalog(candidate), /Snapshot depends on excluded claim/);
});
