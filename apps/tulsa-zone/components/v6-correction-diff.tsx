import React from 'react';
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
  const oldClaims=new Map(before.claims.map(c=>[c.id,c]));
  const newClaims=new Map(current.claims.map(c=>[c.id,c]));
  const zh=locale==='zh',prefix=locale==='en'?'':`/${locale}`;
  const groups=[{label:zh?'新增':'Added',ids:changes.addedClaimIds,kind:'added'},
    {label:zh?'修订':'Updated',ids:changes.updatedClaimIds,kind:'updated'},
    {label:zh?'暂缓／退出当前主张':'Held / excluded from current claims',ids:changes.heldClaimIds,kind:'held'}];
  return <section className="page-shell" data-correction-diff={slug}>
    <h2>{zh?'本次网站记录修复差异':'Tracker correction differences'}</h2>
    <p>{zh?'以下比较冻结的旧记录与本次修订。新增表示网站补录；暂缓不表示大学取消了政策。修订时间不是大学政策生效日期。':'These compare the frozen previous record with this correction. Added means newly recorded by the tracker; held does not mean a university repealed a rule. Correction time is not a university policy effective date.'}</p>
    {groups.map(group=><div key={group.kind} data-correction-kind={group.kind}><h3>{group.label} ({group.ids.length})</h3>{group.ids.map(id=>{
      const old=oldClaims.get(id) ?? pkg.heldBySlug[slug]?.find(c=>c.id===id),next=newClaims.get(id);
      return <details key={id} className="notice-card" data-correction-claim={id}><summary>{id} — {(next??old)?.claimText}</summary>
        {old?<p data-i18n="preserve"><strong>{zh?'修订前：':'Before: '}</strong>{old.claimText}</p>:null}
        {next?<p data-i18n="preserve"><strong>{zh?'修订后：':'After: '}</strong>{next.claimText}</p>:null}
        {group.kind==='held'?<p>{zh?'历史证据保留，本条不作为当前许可或义务。':'Historical evidence retained; excluded from current permissions or duties.'}</p>:null}
        {next?<a href={`${prefix}/universities/${slug}#claim-${encodeURIComponent(id)}`}>{zh?'查看当前原文证据':'Current source evidence'}</a>:<a href={`${prefix}/universities/${slug}#v6-held-public-claims`}>{zh?'查看暂缓证据':'Held evidence'}</a>}
      </details>;
    })}</div>)}
  </section>;
}
