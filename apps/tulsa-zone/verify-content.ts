import {getStagedPublicSummaries} from '../web/lib/staged-public-data';
import {loadTulsaContent} from './lib/runtime-content';
import {runtimeUniversitySlugs} from './lib/schools';
async function main(){
 const all=await getStagedPublicSummaries();
 for(const slug of runtimeUniversitySlugs){const summary=all.find(x=>x.entity.slug===slug)!;const c=await loadTulsaContent(slug,summary.claims);console.log(slug,c.records.length);}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
