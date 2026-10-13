import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import type {SupportedLocale} from './i18n';
import type {LabSchool} from './policy-v6';
import type {LocalV6Bundle} from './policy-v6-bundle';
import type {LocalV6Evidence} from './policy-v6-local-evidence';
import pointer from '../../../data/public-v6-pages/current.json';
import {publishedV6Slugs,publishedV6Enabled} from './policy-v6-published-gate';
export {publishedV6Slugs,publishedV6Enabled} from './policy-v6-published-gate';
interface LocaleData {schools:LabSchool[];views:Record<string,LocalV6Bundle>;localEvidence:Record<string,LocalV6Evidence>;entities:Record<string,unknown>;related:Record<string,unknown>}
let cached:{releaseId:string;slugs:string[];locales:Record<SupportedLocale,LocaleData>}|undefined;
export function readPublishedV6(){
 if(!publishedV6Enabled())return undefined;
 if(!cached){const root=resolve(process.cwd(), process.cwd().endsWith('/apps/tulsa-zone') || process.cwd().endsWith('/apps/web') ? '../../data/public-v6-pages' : 'data/public-v6-pages');const path=resolve(root,pointer.path);if(!path.startsWith(root+'/'))throw Error('Invalid public V6 path');const raw=readFileSync(path);if(createHash('sha256').update(raw).digest('hex')!==pointer.sha256)throw Error('Published V6 package changed');const j=JSON.parse(raw.toString());if(j.schemaVersion!=='uapt-v6-published-pages-v1'||j.publicationApproved!==true||j.slugs.join(',')!==pointer.slugs.join(','))throw Error('Published V6 identity mismatch');cached=j;}
 return cached!;
}
export function publishedV6Locale(locale:SupportedLocale){return readPublishedV6()?.locales[locale];}
export function publishedV6School(slug:string,locale:SupportedLocale){const s=publishedV6Locale(locale)?.schools.find(s=>s.slug===slug);return s?structuredClone(s):undefined;}
export function publishedV6Bundle(slug:string,locale:SupportedLocale){const s=publishedV6Locale(locale)?.views[slug];return s?structuredClone(s):undefined;}
export function publishedV6Evidence(slug:string){const s=publishedV6Locale('en')?.localEvidence[slug];return s?structuredClone(s):undefined;}
