import { getChangeRecords } from "@/lib/change-records";
import { toRfc822Date, xmlEscape, xmlResponse } from "@/lib/feed";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

export const dynamic = "force-static";

export async function GET() {
  const records = (await getChangeRecords()).slice(0, 50);
  const siteUrl = getAbsoluteSiteUrl("/");
  const feedUrl = getAbsoluteSiteUrl("/feeds/recent-changes.xml");
  const latestDate = records[0]?.lastChangedAt ?? records[0]?.lastCheckedAt;
  const items = records
    .map((record) => {
      const url = getAbsoluteSiteUrl(record.changeUrl);
      const freshness = record.lastChangedAt ?? record.lastCheckedAt;
      const description = `${record.summary} Claims: ${record.claimCount}. Reviewed claims: ${record.reviewedClaimCount}. Candidate or non-reviewed claims: ${record.candidateClaimCount}. Review state: ${record.reviewState}.`;

      return `<item>
  <title>${xmlEscape(`${record.name} AI policy change record`)}</title>
  <link>${xmlEscape(url)}</link>
  <guid isPermaLink="true">${xmlEscape(url)}</guid>
  <pubDate>${xmlEscape(toRfc822Date(freshness))}</pubDate>
  <description>${xmlEscape(description)}</description>
</item>`;
    })
    .join("\n");

  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>University AI Policy Tracker Recent Changes</title>
  <link>${xmlEscape(siteUrl)}</link>
  <description>Institution-level source checks and public change records from University AI Policy Tracker.</description>
  <lastBuildDate>${xmlEscape(toRfc822Date(latestDate))}</lastBuildDate>
  <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${xmlEscape(feedUrl)}" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>
`);
}
