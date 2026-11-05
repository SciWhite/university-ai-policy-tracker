import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {SupportedLocale} from './i18n';
import type {LabSchool} from './policy-v6';
import type {LocalV6Bundle} from './policy-v6-bundle';
import type {LocalV6Evidence} from './policy-v6-local-evidence';
import {publishedV6Enabled} from './policy-v6-published-gate';
import {V6ArtifactStore, readVerifiedArtifact, v6PublicDataRoot, type ShardIndex} from './v6-artifact-store';
import {getLocalQACandidatePages} from './v6-qa-candidate';
import {readContentJson} from './content-runtime';
export {publishedV6Slugs,isPublishedV6Slug,publishedV6Enabled} from './policy-v6-published-gate';
interface LocaleData {schools:LabSchool[];views:Record<string,LocalV6Bundle>;localEvidence:Record<string,LocalV6Evidence>;entities:Record<string,unknown>;related:Record<string,unknown>}
export type PublishedV6Package={schemaVersion:string;publicationApproved:boolean;candidateOnly?:true;releaseId:string;slugs:string[];v5Slugs?:string[];v5Presentation?:{slug:string;layout:string;revision:string;recordSha256:string;claimIds:string[];institutionAuditStatus:string;snapshotStatus:string};locales:Record<SupportedLocale,LocaleData>;publishedAt?:string;publicationKind?:string;changeSummary?:{en:string;zh:string}};
type PagesPointer={path:string;sha256:string;releaseId:string;slugs:string[];v5Slugs?:string[]};
/** Pointer, registry and shard index come from the active content release, never the build. */
const currentPointer=()=>readContentJson<PagesPointer>('data/public-v6-pages/current.json');
const revisions=()=>readContentJson<Record<string,{path:string;sha256:string}>>('data/public-v6-pages/revisions.json');
const shardIndex=()=>readContentJson<ShardIndex>('data/public-v6-pages/sharded/index.json');
/** Separate bounded V5 cohort; never grants V6 presentation approval. */
export const publishedV5Slugs=():string[]=>currentPointer().v5Slugs??[];
export const publishedV6ReleaseId=()=>currentPointer().releaseId;
const store = () => new V6ArtifactStore(v6PublicDataRoot('public-v6-pages'), shardIndex());
const useShards = (revision: string) => process.env.UAPT_V6_LEGACY_DATA !== '1' && Object.hasOwn(shardIndex().revisions, revision);

export function readPublishedV6(){
  if (process.env.NODE_ENV === "development" && process.env.UAPT_LOCAL_QA_CANDIDATE_PAGES) {
    const candidate = getLocalQACandidatePages();
    if (candidate) return candidate;
  }
  return readPublishedV6Revision(currentPointer().releaseId);
}
/** A lazy compatibility view: only full-package JSON enumeration reads all shards. */
export function readPublishedV6Revision(revision:string): PublishedV6Package | undefined {
  if(!publishedV6Enabled())return undefined;
  if (process.env.NODE_ENV === "development" && process.env.UAPT_LOCAL_QA_CANDIDATE_PAGES) {
    const candidate = getLocalQACandidatePages();
    if (candidate && candidate.releaseId === revision) return candidate;
  }
  const pointer=currentPointer(),entry=revisions()[revision];
  const value = useShards(revision)
    ? store().view<PublishedV6Package>(revision, entry?.sha256 ?? (revision === pointer.releaseId ? pointer.sha256 : undefined))
    : entry ? readVerifiedArtifact<PublishedV6Package>(v6PublicDataRoot('public-v6-pages'),entry.path,entry.sha256,128*1024*1024) : undefined;
  if (value && (value.schemaVersion !== 'uapt-v6-published-pages-v1' || value.publicationApproved !== true || value.candidateOnly===true || value.releaseId !== revision)) throw new Error('Published V6 identity mismatch');
  return value;
}
/** Published V6/V5 revisions in the active content release; each has a /changes note. */
export function publishedV6RevisionIds(): string[] {
  if (!publishedV6Enabled()) return [];
  return Object.keys(revisions()).filter(revision => {
    try { return Boolean(readPublishedV6Revision(revision)); }
    catch { return false; }
  });
}
export function publishedV6Locale(locale:SupportedLocale){return readPublishedV6()?.locales[locale];}
export function publishedV6SchoolNames(locale: SupportedLocale): Record<string, string> {
  if (!publishedV6Enabled()) return {};
  const pointer=currentPointer();
  if (useShards(pointer.releaseId)) {
    readPublishedV6();
    return structuredClone(store().manifest(pointer.releaseId)!.schoolNames?.[locale] ?? {});
  }
  return Object.fromEntries((publishedV6Locale(locale)?.schools ?? []).map(s => [s.slug, s.name]));
}
export function publishedV6School(slug:string,locale:SupportedLocale,revision=publishedV6ReleaseId()){
  const pointer=currentPointer();
  const selected = readPublishedV6();
  if (!selected) return undefined;
  if (selected.releaseId !== pointer.releaseId && revision === pointer.releaseId) {
    const school=selected.locales[locale]?.schools.find(s=>s.slug===slug);
    return school ? structuredClone(school) : undefined;
  }
  const revPkg = readPublishedV6Revision(revision);
  if (!revPkg) return undefined;
  if (useShards(revision)) return store().field<LabSchool>(revision,['locales',locale,'schools',slug]);
  const school=revPkg.locales[locale]?.schools.find(s=>s.slug===slug);
  return school ? structuredClone(school) : undefined;
}
export function publishedV6Bundle(slug:string,locale:SupportedLocale,revision=publishedV6ReleaseId()){
  const pointer=currentPointer();
  const selected = readPublishedV6();
  if(!selected)return undefined;
  if (selected.releaseId !== pointer.releaseId && revision === pointer.releaseId) {
    return structuredClone(selected.locales[locale]?.views[slug]);
  }
  const revPkg=readPublishedV6Revision(revision);
  if(!revPkg)return undefined;
  return useShards(revision) ? store().field<LocalV6Bundle>(revision,['locales',locale,'views',slug]) : structuredClone(revPkg.locales[locale]?.views[slug]);
}
export function publishedV6Evidence(slug:string,revision=publishedV6ReleaseId()){
  const pointer=currentPointer();
  const selected=readPublishedV6Revision(revision);
  if(!selected)return undefined;
  return useShards(revision) ? store().field<LocalV6Evidence>(revision,['locales','en','localEvidence',slug]) : structuredClone(selected.locales.en.localEvidence[slug]);
}
