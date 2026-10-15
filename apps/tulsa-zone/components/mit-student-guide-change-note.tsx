import type {SupportedLocale} from '@/lib/i18n';
/** Presentation history is separate from university-policy dates and canonical record revisions. */
export function MitStudentGuideChangeNote({locale='en'}:{locale?:SupportedLocale}){
 const zh=locale==='zh',prefix=locale==='en'?'':'/'+locale;
 return <section className="page-shell" id="mit-v6-student-actions-20261015" data-presentation-change="mit-v6-student-actions-20261015"><h2>{zh?'AI 使用指引与疑虑处理入口更新':'AI use guide and concern-handling navigation updated'}</h2><p><time dateTime="2026-10-15">2026-10-15</time></p><p lang={zh?'zh':'en'} data-i18n="preserve">{zh?'MIT 页面恢复紧凑版建议做／应避免、调查与回应、可能后果及申诉入口。保留原有情境插画与主题说明；政策主张、原文及审核状态未改。':'The MIT page restores compact Do / Don’t guidance and investigation, possible-outcome and appeal navigation. Existing illustrations and topic explanations are retained; policy claims, original evidence and review states are unchanged.'}</p><a href={`${prefix}/universities/massachusetts-institute-of-technology#quick-guide`}>{zh?'查看 MIT 使用指引':'View the MIT use guide'}</a></section>;
}
