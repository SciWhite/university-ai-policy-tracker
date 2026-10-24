import React from "react";
import {getEventIndexPage} from "@/lib/change-index-events-api";
import {changeIndexEventsCopy} from "@/lib/change-index-events-copy";
import {v6ChangesCopy} from "@/lib/v6-changes-copy";
import {withLocalePrefix,type SupportedLocale} from "@/lib/i18n";
import {getAbsoluteSiteUrl} from "@/lib/site-url";
import {ChangeIndexEventsBrowser} from "./change-index-events-browser";
import {CopyCurrentLink} from "./copy-current-link";
import {JsonLd} from "./json-ld";

export async function ChangeIndexEventsPage({locale}:{locale:SupportedLocale}){
  let initial;
  try{initial=await getEventIndexPage(locale);}catch{return <main className="page-shell page-shell--wide"><h1>{changeIndexEventsCopy(locale).title}</h1><p role="alert">{v6ChangesCopy(locale).failed}</p><a href={withLocalePrefix("/changes",locale)}>{v6ChangesCopy(locale).retry}</a></main>;}
  if(!initial)return null;
  const ui=changeIndexEventsCopy(locale),copy=v6ChangesCopy(locale),canonical=getAbsoluteSiteUrl(withLocalePrefix("/changes",locale)),base=`/api/public/v1/changes/events/${initial.revision}`;
  return <main className="page-shell page-shell--wide change-history-page" data-discovery-page="changes-events">
    <JsonLd data={{"@context":"https://schema.org","@type":"CollectionPage",name:ui.title,description:ui.scope,url:canonical,inLanguage:locale,mainEntity:{"@type":"ItemList",numberOfItems:initial.total,itemListElement:initial.rows.map((row,index)=>({"@type":"ListItem",position:index+1,url:getAbsoluteSiteUrl(withLocalePrefix(row.url,locale)),name:row.localizedName}))}}}/>
    <header className="entity-header"><div className="entity-header__main"><h1>{ui.title}</h1><p>{ui.scope}</p></div><div className="entity-header__actions"><a className="site-action" href="/feeds/recent-changes.xml">{ui.rss}</a><CopyCurrentLink locale={locale}/></div></header>
    <ChangeIndexEventsBrowser initial={initial} locale={locale}/>
    <nav className="change-events-data"><a href={`${base}/index.json?locale=${locale}`}>{ui.indexJson}</a><a href={`${base}/latest.json?locale=${locale}`}>{ui.latestJson}</a><a href={`${base}/recent.json?locale=${locale}`}>{ui.recentJson}</a></nav>
  </main>;
}
