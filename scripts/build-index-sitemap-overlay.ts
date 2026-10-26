import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import scope from '../data/index-sitemap-removal-scope.json';
import {applyIndexSitemapOverlay} from '../apps/web/lib/index-sitemap-overlay';
const output=process.argv[2];if(!output)throw Error('Pass a new output directory');
fs.mkdirSync(output,{recursive:true});const rows=[];
for(const section of Object.keys(scope.sections)){
 const file=path.join('data/index-sitemap-source',section),before=fs.readFileSync(file,'utf8'),after=applyIndexSitemapOverlay(before,section);
 const beforeEntries=before.match(/<url\b[^>]*>[\s\S]*?<\/url>/g)??[],afterEntries=after.match(/<url\b[^>]*>[\s\S]*?<\/url>/g)??[];
 const expected=new Set(scope.sections[section as keyof typeof scope.sections]);
 const removed=beforeEntries.filter(x=>!afterEntries.includes(x));
 if(removed.length!==expected.size||removed.some(x=>!expected.has(/<loc>([^<]+)<\/loc>/.exec(x)![1])))throw Error('Unexpected removal '+section);
 const target=path.join(output,section);if(fs.existsSync(target)&&fs.readFileSync(target,'utf8')!==after)throw Error('Immutable sitemap collision');
 fs.writeFileSync(target,after);rows.push({section,beforeCount:beforeEntries.length,afterCount:afterEntries.length,removed:removed.length,beforeSha256:createHash('sha256').update(before).digest('hex'),afterSha256:createHash('sha256').update(after).digest('hex'),retainedEntriesByteIdentical:true});
}
fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify({schemaVersion:'uapt-exact-sitemap-overlay-v1',rows},null,2)+'\n');console.log(JSON.stringify(rows.map(r=>({section:r.section,removed:r.removed,after:r.afterCount}))));
