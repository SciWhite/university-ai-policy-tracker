import { discoveryCopy } from "@/lib/discovery-copy";
import { localizeSurfaceTree } from "@/lib/surface-localization";
import { normalizeLocale } from "@/lib/i18n";
import type {SupportedLocale} from '@/lib/i18n';
import {publishedV6School} from '@/lib/policy-v6-published';
/** A presentation event; university policy revision and RSS dates are deliberately unchanged. */
export function V6CompactChangeNote({slug,locale='en'}:{slug:string;locale?:SupportedLocale}) {
 const school=publishedV6School(slug,locale);
 if(!school)return null;
 const zh=locale==='zh',prefix=locale==='en'?'':'/'+locale;
 return localizeSurfaceTree(<><section className="page-shell" id="v6-homepage-links-20261015" data-presentation-change="v6-homepage-links-20261015"><h2>{zh?'校徽链接大学官方首页':'University mark links to official homepage'}</h2><p><time dateTime="2026-10-15">2026-10-15</time></p><p>{slug==='peking-university'?(zh?'北京大学接入共享 V6 模板，保留全部现行主张、工具及限定程序；校徽链接大学官方首页。政策数据与审核状态不变。':'Peking University joins the shared V6 template with its current claims, tools and scoped procedures retained. The header mark links to the official university homepage. Policy records and review states are unchanged.'):(zh?'标题校徽现在链接大学官方首页。政策内容、证据及审核状态未改。':'The header university mark now links to the official university homepage. Policy content, evidence and review states are unchanged.')}</p><a href={`${prefix}/universities/${slug}`}>{zh?'查看大学页面':'View university page'} ↗</a></section><section className="page-shell" id="v6-compact-20261015" data-presentation-change="v6-compact-20261015">
  <h2>{zh?'V6 紧凑模板更新':'Compact V6 template update'}</h2>
  <p><time dateTime="2026-10-15">2026-10-15</time></p>
  <p lang={zh?'zh':'en'} data-i18n="preserve">{zh?'采用已验收的帝国理工页面布局：紧凑四问、等高主题卡、提交检查快捷入口、逐项依据与手机长证据阅读。行动建议分别标注要求或建议，正文使用深色，红绿保留于标题和边线。移除情境插画及重复清单，FAQ 按需展开。各校规则、原文、工具资格、历史记录与证据缺口保留；政策日期、审核状态及正式学生快照未改变。':'Uses the accepted Imperial composition: four compact questions, equal-height topic cards, a submission shortcut, individual evidence links and expanded mobile evidence reading. Actions distinguish requirements from advice; prose is neutral, with semantic headings and borders. Scenario artwork and duplicate checklists are removed; FAQ is expandable. School-specific rules, original quotations, tool eligibility, history and evidence gaps remain. Policy dates, review states and formal student snapshots are unchanged.'}</p>
  {!zh&&locale!=='en'?<p>{discoveryCopy(locale).summaryFallback}</p>:null}
  <a href={`${prefix}/universities/${slug}`}>{zh?'查看大学页面':'View university page'} ↗</a>
 </section></>, normalizeLocale(locale));
}
