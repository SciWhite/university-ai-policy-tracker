import { unstable_cache } from "next/cache";
import { activeContent } from "./content-runtime";

/**
 * Cache tags for content-rendered routes. A content switch is followed by
 * revalidateTag() for the tags whose pages changed (see
 * app/api/internal/content/refresh). Every tagged route also carries
 * CONTENT_TAG so an operator can expire all content pages at once.
 */
export const CONTENT_TAG = "content";
const TAG = /^(?:content|home|catalog|universities|changes|reports|sitemap|school:[a-z0-9]+(?:-[a-z0-9]+)*|changes:[A-Za-z0-9._-]+|report:\d{4}-\d{2})$/;

export const contentTagFor = {
  school: (slug: string) => `school:${slug}`,
  changesRelease: (releaseId: string) => `changes:${releaseId}`,
  report: (month: string) => `report:${month}`
};

export function isContentTag(tag: string): boolean {
  return TAG.test(tag) && tag.length <= 160;
}

/**
 * Attach tags to the ISR entry being rendered. Next copies unstable_cache tags
 * onto the enclosing page/route cache entry; the cached value is never read.
 * Outside the Next server (tests, scripts) this is a no-op.
 */
export async function tagContent(...tags: string[]): Promise<void> {
  if (!process.env.NEXT_RUNTIME) return;
  const valid = [...new Set([CONTENT_TAG, ...tags.filter(isContentTag)])].sort();
  try {
    await unstable_cache(async () => activeContent().contentId, ["uapt-content-tags", ...valid], { tags: valid })();
  } catch (error) {
    // Tagging must never break a render; the page still expires by revalidatePath/time.
    console.error(JSON.stringify({ message: "Content tag registration failed", tags: valid, error: error instanceof Error ? error.message : String(error) }));
  }
}
