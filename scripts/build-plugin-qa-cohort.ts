import { readFile, mkdir, writeFile } from "node:fs/promises";
import { loadCatalog } from "../apps/mcp/src/catalog";
import { parseBingAiOverviewCsv, parseBingAiPagesCsv } from "../apps/web/lib/bing-ai-performance";
import { stripLocalePrefix } from "../apps/web/lib/i18n";
async function main() {
  const catalog=await loadCatalog("apps/mcp/.runtime-data/catalog.json");
  const bing=JSON.parse(await readFile(".local/plugin-qa/bing-september.json","utf8"));
  const aiDirectory=process.env.UAPT_QA_AI_DIRECTORY ?? ".local/data/bing-ai-performance";
  let aiRows: {key:string;citations:number}[]=[]; let aiStart:string|undefined,aiEnd:string|undefined;
  try {
    aiRows=parseBingAiPagesCsv(await readFile(`${aiDirectory}/pages.csv`,"utf8"));
    const overview=parseBingAiOverviewCsv(await readFile(`${aiDirectory}/overview.csv`,"utf8"));
    aiStart=overview[0]?.key;aiEnd=overview.at(-1)?.key;
  } catch { /* Missing is recorded as unknown, never as zero demand. */ }
  const normalize = (value:string) => {
    try { const url=new URL(value);if(!["eduaipolicy.org","www.eduaipolicy.org"].includes(url.hostname))return undefined;
      return stripLocalePrefix(url.pathname.replace(/\/$/,"")).pathname.match(/^\/universities\/([a-z0-9-]+)$/)?.[1];
    }catch{return undefined;}
  };
  const metrics = catalog.records.map(r=>({slug:r.summary.entity.slug,name:r.summary.entity.name,clicks:null as number|null,impressions:null as number|null,citations:null as number|null}));
  const map=new Map(metrics.map(r=>[r.slug,r]));
  for (const row of bing.pageRows ?? []) {const r=map.get(normalize(row.url) ?? "");if(r){r.clicks=(r.clicks??0)+row.clicks;r.impressions=(r.impressions??0)+row.impressions;}}
  for (const row of aiRows) {const r=map.get(normalize(row.key) ?? "");if(r)r.citations=(r.citations??0)+row.citations;}
  const fields=["clicks","impressions","citations"] as const,weights=[.4,.3,.3];
  const percentile=(field:typeof fields[number],value:number) => {
    if (value === 0) return 0;
    const values=metrics.flatMap(r=>r[field] !== null && r[field]! > 0 ? [r[field]!] : []).sort((a,b)=>a-b);
    return values.length ? values.filter(v=>v<=value).length/values.length : 0;
  };
  const ranked=metrics.map(r=>{
    const known=fields.filter(f=>r[f]!==null);
    const availableWeight=known.reduce((n,f)=>n+weights[fields.indexOf(f)],0);
    const score=known.reduce((n,f)=>n+weights[fields.indexOf(f)]*percentile(f,r[f]!),0)/(availableWeight||1);
    return {...r,score,availableWeight,missingMetrics:fields.filter(f=>r[f]===null),realClientQa:"pending"};
  }).sort((a,b)=>b.score-a.score || b.availableWeight-a.availableWeight || a.slug.localeCompare(b.slug));
  const result={releaseId:catalog.releaseId,bingAvailable:bing.available,bingPeriod:[bing.coverageStart,bing.coverageEnd],aiCitationPeriod:[aiStart??null,aiEnd??null],
    method:"Positive-value percentile scores; observed zeros score zero. Weights .4/.3/.3 renormalized over available metrics. Missing values remain null. AI CSV is a sampled multi-month snapshot, not September-only or ChatGPT invocation data. Slug breaks ties; no access whitelist.",
    priorityQa:ranked.slice(0,100),allEligibleUniversities:metrics.length};
  await mkdir(".local/plugin-qa",{recursive:true});await writeFile(".local/plugin-qa/cohort.json",JSON.stringify(result,null,2));
  console.log(JSON.stringify({universities:metrics.length,priorityQa:result.priorityQa.length,bingAvailable:bing.available,aiCitationPeriod:result.aiCitationPeriod}));
}
main().catch(()=>{console.error("QA cohort generation failed");process.exitCode=1;});
