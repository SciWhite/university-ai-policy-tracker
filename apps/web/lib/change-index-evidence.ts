import { cache } from "react";
import { loadSelectedChangeEventIndex } from "./change-events-api";

const protectedEvents = cache(async () => {
  try {
    const index = await loadSelectedChangeEventIndex();
    return index ? new Set(index.rows.map(row => `${row.revision}/${row.slug}`)) : undefined;
  } catch { return undefined; }
});
export async function releaseDiffEventState(releaseId: string, slug: string): Promise<"none" | "present" | "unknown"> {
  const events = await protectedEvents();
  return !events ? "unknown" : events.has(`${releaseId}/${slug}`) ? "present" : "none";
}
