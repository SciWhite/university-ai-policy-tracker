export function uniqueSitemapEntries<T extends { url: string; lastModified: Date }>(
  entries: readonly T[]
): T[] {
  const unique = new Map<string, T>();
  for (const entry of entries) {
    const existing = unique.get(entry.url);
    if (!existing || entry.lastModified > existing.lastModified) {
      unique.set(entry.url, entry);
    }
  }
  return [...unique.values()];
}
