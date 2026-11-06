import { changesUi } from "@/lib/changes-ui";
import { localizeSurfaceTree } from "@/lib/surface-localization";
import { normalizeLocale } from "@/lib/i18n";
import React from 'react';
import {publishedV6School} from '@/lib/policy-v6-published';
import {readV6RecordCorrectionRevision,v6SummaryAtRevision} from '@/lib/v6-effective-records';

/** Tracker edits against the frozen school baseline, never university enactment dates. */
export function V6CorrectionDiff({revision,slug,locale}:{revision:string;slug:string;locale:string}) {
  const pkg=readV6RecordCorrectionRevision(revision);
  if(!pkg||pkg.recordRevisions[slug]?.universityRevisionId!==revision)return null;
  const changes=pkg.changesBySlug[slug];
  const current=v6SummaryAtRevision(slug,revision)!;
  const before=(pkg.recordRevisions[slug]?.previousRevisionId ? v6SummaryAtRevision(slug,pkg.recordRevisions[slug].previousRevisionId) : undefined)
    ?? (pkg.parentRevisionId ? v6SummaryAtRevision(slug,pkg.parentRevisionId) : undefined) ?? pkg.historical[slug]?.baseline;
  if(!before)return null;
  const currentSchool=publishedV6School(slug,'en',revision);
  const previousRevision=pkg.recordRevisions[slug]?.previousRevisionId??pkg.parentRevisionId;
  const previousSchool=previousRevision?publishedV6School(slug,'en',previousRevision):undefined;
  const supplementary=[...(before.entity.summary!==current.entity.summary?[{field:'Record inventory summary',before:before.entity.summary??'',after:current.entity.summary??''}]:[]),
    ...(currentSchool?.topics.flatMap(topic=>{const previous=previousSchool?.topics.find(t=>t.key===topic.key);return previous&&previous.summary!==topic.summary?[{field:topic.title,before:previous.summary,after:topic.summary}]:[]})??[])];
  const oldClaims=new Map(before.claims.map(c=>[c.id,c]));
  const newClaims=new Map(current.claims.map(c=>[c.id,c]));
  const zh=locale==='zh',prefix=locale==='en'?'':`/${locale}`;
  const groups=[{label:zh?'新增':'Added',ids:[...new Set(changes.addedClaimIds)],kind:'added'},
    {label:zh?'修订':'Updated',ids:[...new Set(changes.updatedClaimIds)].filter(id=>!changes.addedClaimIds.includes(id)),kind:'updated'},
    {label:zh?'暂缓／移出当前结论':'Held / excluded from current conclusions',ids:[...new Set(changes.heldClaimIds)],kind:'held'}];
  return localizeSurfaceTree(<section className="page-shell" data-correction-diff={slug}>
    <h2>{zh?'本次网站记录修复差异':'Tracker correction differences'}</h2>
    <p>{zh?'以下比较冻结的旧记录与本次修订。新增表示网站补录；暂缓不表示大学取消了政策。修订时间不是大学政策生效日期。':'These compare the frozen previous record with this correction. Added means newly recorded by the tracker; held does not mean a university repealed a rule. Correction time is not a university policy effective date.'}</p>
    {supplementary.length?<div data-summary-corrections={slug}><h3>{zh?'学生摘要与统计修订':'Student summary and inventory corrections'}</h3>{supplementary.map(row=><details className="notice-card" key={row.field}><summary>{row.field}</summary><p lang="en" data-i18n="preserve"><strong>{changesUi("Before:", normalizeLocale(locale))}{" "}</strong>{row.before}</p><p lang="en" data-i18n="preserve"><strong>{changesUi("After:", normalizeLocale(locale))}{" "}</strong>{row.after}</p></details>)}</div>:null}
    {groups.map(group=><div key={group.kind} data-correction-kind={group.kind}><h3>{group.label} ({group.ids.length})</h3>{group.ids.map(id=>{
      const old=oldClaims.get(id) ?? pkg.heldBySlug[slug]?.find(c=>c.id===id),next=newClaims.get(id);
      return <details key={id} className="notice-card" data-correction-claim={id}><summary data-i18n="preserve" lang="en">{id} — {(next??old)?.claimText}</summary>
        {old?<p lang="en" data-i18n="preserve"><strong>{changesUi("Before:", normalizeLocale(locale))}{" "}</strong>{old.claimText}</p>:null}
        {next?<p lang="en" data-i18n="preserve"><strong>{changesUi("After:", normalizeLocale(locale))}{" "}</strong>{next.claimText}</p>:null}
        {group.kind==='held'?<p>{zh?'历史证据保留，本条不作为当前许可或义务。':'Historical evidence retained; excluded from current permissions or duties.'}</p>:null}
        {next?<a href={`${prefix}/universities/${slug}#claim-${encodeURIComponent(id)}`}>{zh?'查看当前原文证据':'Current source evidence'}</a>:<a href={`${prefix}/universities/${slug}#v6-held-public-claims`}>{zh?'查看暂缓证据':'Held evidence'}</a>}
      </details>;
    })}</div>)}
  </section>, normalizeLocale(locale));
}
