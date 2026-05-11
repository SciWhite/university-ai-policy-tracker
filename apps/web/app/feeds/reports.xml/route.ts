import { toRfc822Date, xmlEscape, xmlResponse } from "@/lib/feed";
import { getReportsIndex } from "@/lib/reports";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

export const dynamic = "force-static";

export async function GET() {
  const reports = await getReportsIndex();
  const siteUrl = getAbsoluteSiteUrl("/");
  const feedUrl = getAbsoluteSiteUrl("/feeds/reports.xml");
  const latestPublishedAt = reports[0]?.publishedAt;
  const items = reports
    .map(
      (report) => `<item>
  <title>${xmlEscape(report.title)}</title>
  <link>${xmlEscape(report.canonicalUrl)}</link>
  <guid isPermaLink="true">${xmlEscape(report.canonicalUrl)}</guid>
  <pubDate>${xmlEscape(toRfc822Date(report.publishedAt))}</pubDate>
  <description>${xmlEscape(report.description)}</description>
</item>`
    )
    .join("\n");

  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>University AI Policy Tracker Reports</title>
  <link>${xmlEscape(siteUrl)}</link>
  <description>Dataset reports and citation-ready summaries from University AI Policy Tracker.</description>
  <lastBuildDate>${xmlEscape(toRfc822Date(latestPublishedAt))}</lastBuildDate>
  <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${xmlEscape(feedUrl)}" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>
`);
}
