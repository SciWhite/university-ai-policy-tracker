import type { BingAiPerformanceSnapshot } from "./bing-ai-performance";

export function withBingAiWindow(snapshot: BingAiPerformanceSnapshot, from: string, to: string): BingAiPerformanceSnapshot {
  const dateRows = snapshot.dateRows.filter(row => row.key >= from && row.key <= to);
  const present = new Set(dateRows.map(row => row.key));
  const missingDays: string[] = [];
  for (let ms = Date.parse(from + "T00:00:00Z"); ms <= Date.parse(to + "T00:00:00Z"); ms += 86400000) {
    const key = new Date(ms).toISOString().slice(0,10);
    if (!present.has(key)) missingDays.push(key);
  }
  const complete = snapshot.available && missingDays.length === 0 && dateRows.length > 0;
  return {...snapshot, window: {
    from, to, dateRows, complete, missingDays: missingDays.length,
    coverageStart: dateRows[0]?.key, coverageEnd: dateRows.at(-1)?.key,
    citations: complete ? dateRows.reduce((sum,row)=>sum+row.citations,0) : null,
    averageCitedPages: complete ? dateRows.reduce((sum,row)=>sum+row.citedPages,0)/dateRows.length : null,
    observedCitations: dateRows.reduce((sum,row)=>sum+row.citations,0),
    detailScope: "Imported page/query/topic tables retain their independent CSV export scope; not filtered to the selected dates."
  }};
}
