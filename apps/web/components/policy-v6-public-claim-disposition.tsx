import React from 'react';
import type {LocalV6Bundle} from '@/lib/policy-v6-bundle';
import type {SupportedLocale} from '@/lib/i18n';
import {PolicyV6ClaimGroups} from './policy-v6-claim-groups';
import {groupReviewedClaimsByClaimType} from '@/lib/university-claims-organization';
/** Public-safe original records and limits; never draft replacements or private audit objects. */
export function PolicyV6PublicClaimDisposition({view,locale}:{view:LocalV6Bundle;locale:SupportedLocale}){
 const rows=view.claimDispositions?.filter(r=>r.mode!=='scoped_reference')??[];if(!rows.length)return null;const zh=locale==='zh';
 return <section id="v6-excluded-public-records" className="student-record-section"><details><summary>{zh?'历史及待复核公开条款':'Historical and pending public Claims'} ({rows.length})</summary><p>{zh?'以下保留原公开记录及来源以便追溯，已从当前主题、FAQ、提交指引和Analysis结论排除；不是当前使用许可。':'These original public records and sources remain traceable. They are excluded from current topics, FAQ, submission and Analysis conclusions and do not establish current permission.'}</p>{rows.map(r=>{const c=view.claims.find(c=>c.id===r.claimId)!;return <article key={r.claimId} data-public-claim-disposition={r.mode} data-public-claim-id={r.claimId}><p>{r.claimId} · {r.mode}</p><p lang="en" data-i18n="preserve">{r.scope}</p><p lang={/[\u3400-\u9fff]/.test(r.reason)?"zh":"en"} data-i18n="preserve">{r.reason}</p><a href={r.historyHref}>{zh?'记录历史':'Record history'}</a><PolicyV6ClaimGroups entitySlug={view.school.slug} groupIdPrefix={`excluded-${r.claimId}-group`} groups={groupReviewedClaimsByClaimType([c])} locale={locale} claimScopes={{[r.claimId]:r.scope}} /></article>})}</details></section>;
}
