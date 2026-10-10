import React from 'react';
import type { UniversityToolRecord } from '@uapt/shared';
import type { SupportedLocale } from '@/lib/i18n';
import { universityToolsUi } from '@/lib/university-tools-ui';

export type PageToolRecord = UniversityToolRecord & { checkedAt?: string; sourceLanguage?: string; relationship?: "institutional_directory" };
const endorsementIndex = { institutionally_licensed_or_procured: 5, officially_endorsed: 6, self_hosted_system: 7, third_party_service: 8, explicitly_not_endorsed: 9, not_specified: 10 } as const;
const availabilityIndex = { allowed: 11, conditionally_allowed: 12, restricted_or_blocked: 13, under_review: 14, not_recommended: 15, not_mentioned: 16 } as const;

/** Access and assessment permission are separate; source text is never rewritten. */
export function UniversityAiTools({ records, locale, currentEvidenceCheckedAt }: { records: PageToolRecord[]; locale: SupportedLocale; currentEvidenceCheckedAt?: string }) {
 const ui = universityToolsUi(locale);
 const supported = records.filter(record => record.evidence.some(e => e.reviewState === 'agent_reviewed' || e.reviewState === 'human_reviewed'));
 return <section id="university-ai-tools" className="university-ai-tools student-record-section" aria-labelledby="university-ai-tools-title">
  <h2 id="university-ai-tools-title">{ui[0]}</h2>
  <p className="university-ai-tools__boundary">{ui[1]}</p>
  {!supported.length ? <p className="muted">{ui[3]}</p> : <>
   <p className="muted">{currentEvidenceCheckedAt ? <span lang={locale === "zh" ? "zh" : "en"} data-i18n="preserve">{locale === "zh" ? "工具官方证据核查日期：" : "Official tool evidence checked: "}<time dateTime={currentEvidenceCheckedAt}>{currentEvidenceCheckedAt.slice(0,10)}</time>{locale === "zh" ? "。访问条件可能更新，请核对官网。" : ". Access conditions may change; consult the official source."}</span> : ui[20]} {locale !== 'en' ? ui[4] : ''}</p>
   <ul className="university-ai-tools__list">{supported.map((record, index) => <li key={`${record.rawToolName}:${record.tool}:${index}`}>
    <div className="university-ai-tools__heading"><strong className="policy-summary-emphasis policy-summary-emphasis--tool" data-i18n="preserve">{record.rawToolName}</strong><span>{record.relationship === "institutional_directory" ? ui[21] : ui[endorsementIndex[record.endorsementType]]}</span><span className={record.availability === 'restricted_or_blocked' ? 'university-ai-tools__restricted' : undefined}>{ui[availabilityIndex[record.availability]]}</span></div>
    <details><summary>{ui[2]}</summary>
     <div data-i18n="preserve" lang={record.sourceLanguage || "und"}>
      {record.description ? <p>{record.description}</p> : null}
      {record.howToObtain ? <p>{record.howToObtain}</p> : null}
      {record.costToUser ? <p>{record.costToUser}</p> : null}
     </div>
     {record.checkedAt ? <p>{ui[19]}: <time dateTime={record.checkedAt}>{record.checkedAt}</time></p> : null}
     {record.evidence.filter(evidence => evidence.reviewState === 'agent_reviewed' || evidence.reviewState === 'human_reviewed').map((evidence, i) => <div className="university-ai-tools__evidence" key={`${evidence.sourceUrl}:${evidence.snapshotHash}:${i}`}>
      <a href={evidence.sourceUrl} target="_blank" rel="noopener noreferrer">{ui[17]} {i + 1} ↗</a>
      <p className="muted">{ui[18]}</p>
      <blockquote data-i18n="preserve" lang={record.sourceLanguage || "und"}>{evidence.evidenceSnippet}</blockquote>
     </div>)}
    </details>
   </li>)}</ul>
  </>}
 </section>;
}
