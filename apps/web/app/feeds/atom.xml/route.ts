import { getChangeRecords } from "@/lib/change-records";
import { toAtomDate, xmlEscape, xmlResponse } from "@/lib/feed";
import { getReportsIndex } from "@/lib/reports";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

export const dynamic = "force-static";

export async function GET() {
  const [reports, changes] = await Promise.all([
    getReportsIndex(),
    getChangeRecords()
  ]);
  const siteUrl = getAbsoluteSiteUrl("/");
  const feedUrl = getAbsoluteSiteUrl("/feeds/atom.xml");
  const reportEntries = reports.map((report) => ({
    id: report.canonicalUrl,
    title: report.title,
    url: report.canonicalUrl,
    updatedAt: report.publishedAt,
    summary: report.description
  }));
  const changeEntries = changes.slice(0, 30).map((record) => ({
    id: getAbsoluteSiteUrl(record.changeUrl),
    title: `${record.name} AI policy change record`,
    url: getAbsoluteSiteUrl(record.changeUrl),
    updatedAt: record.lastChangedAt ?? record.lastCheckedAt,
    summary: `${record.summary} Review state: ${record.reviewState}. Claims: ${record.claimCount}.`
  }));
  const entries = [...reportEntries, ...changeEntries].sort(
    (left, right) =>
      new Date(right.updatedAt ?? 0).getTime() -
      new Date(left.updatedAt ?? 0).getTime()
  );
  const updatedAt = entries[0]?.updatedAt;
  const entryXml = entries
    .map(
      (entry) => `<entry>
  <title>${xmlEscape(entry.title)}</title>
  <id>${xmlEscape(entry.id)}</id>
  <link href="${xmlEscape(entry.url)}" />
  <updated>${xmlEscape(toAtomDate(entry.updatedAt))}</updated>
  <summary>${xmlEscape(entry.summary)}</summary>
</entry>`
    )
    .join("\n");

  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>University AI Policy Tracker Feed</title>
  <id>${xmlEscape(siteUrl)}</id>
  <link href="${xmlEscape(siteUrl)}" />
  <link href="${xmlEscape(feedUrl)}" rel="self" />
  <updated>${xmlEscape(toAtomDate(updatedAt))}</updated>
${entryXml}
</feed>
`);
}
