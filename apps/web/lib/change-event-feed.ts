import {changeIndexEventsCopy} from "./change-index-events-copy";
import {xmlEscape,toRfc822Date} from "./feed";
import {eventSurfaceRows,type ChangeIndexEvent} from "./change-index-events";
import {v6ChangesCopy,changeCategoryKeys} from "./v6-changes-copy";

export function buildChangeEventFeed(rows:ChangeIndexEvent[],identity:{revision:string;projectionSha256:string;basisSha256:string;rulesVersion:string},siteUrl:string,feedUrl:string){
  const dates=rows.flatMap(row=>row.publishedAt?[row.publishedAt]:[]).sort((a,b)=>Date.parse(a)-Date.parse(b));
  const window={start:dates[0]?new Date(dates[0]).toISOString():"1970-01-01T00:00:00Z",end:dates.at(-1)?new Date(dates.at(-1)!).toISOString():"1970-01-01T00:00:00Z",limit:50};
  const events=eventSurfaceRows(rows,"recent",window),copy=v6ChangesCopy("en");
  const items=events.map(event=>`<item>
<title>${xmlEscape(`${event.name} — tracker record revision`)}</title>
<link>${xmlEscape(new URL(event.url,siteUrl).href)}</link>
<guid isPermaLink="false">${xmlEscape(event.id)}</guid>
<pubDate>${xmlEscape(toRfc822Date(event.publishedAt!))}</pubDate>
<description>${xmlEscape(event.categories.map(key=>copy.categories[changeCategoryKeys.indexOf(key)]).join("; ")+". "+changeIndexEventsCopy("en").scope)}</description>
</item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:uapt="urn:uapt:change-events:v1" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>University AI Policy Tracker — Record updates</title><link>${xmlEscape(siteUrl)}</link>
<description>${xmlEscape(changeIndexEventsCopy("en").scope)}</description>
${events[0]?.publishedAt?`<lastBuildDate>${xmlEscape(toRfc822Date(events[0].publishedAt))}</lastBuildDate>`:""}
<atom:link href="${xmlEscape(feedUrl)}" rel="self" type="application/rss+xml"/>
<uapt:projection revision="${xmlEscape(identity.revision)}" sha256="${identity.projectionSha256}" basisSha256="${identity.basisSha256}" rulesVersion="${xmlEscape(identity.rulesVersion)}"/>
<uapt:window start="${window.start}" end="${window.end}" limit="${window.limit}"/>
${items}</channel></rss>`;
}
