import { V6_SOURCE_METADATA_FILE, v6SourceMetadataProjection, v6SourceMetadataSchema, v6SourceUrlKey, type V6SourceDocument, type V6SourceMetadata } from "@uapt/shared";
import { contentScoped, readContentJson } from "./content-runtime";

/**
 * Agent-reviewed document metadata for official sources, read from the active
 * content release. A release without the file (or with an invalid one) simply
 * shows no metadata: it never blocks the university page.
 */
function loadV6SourceMetadata(): V6SourceMetadata | undefined {
  try {
    // A read error throws out of contentScoped, so it is not cached; the next request retries.
    return contentScoped("v6-source-metadata", () => {
      const raw = readContentJson<unknown>(V6_SOURCE_METADATA_FILE, { optional: true, maxBytes: 16 * 1024 * 1024 });
      if (raw === undefined || raw === null) return undefined;
      const parsed = v6SourceMetadataSchema.safeParse(raw);
      if (!parsed.success) {
        console.error("V6 source metadata failed validation:", parsed.error.issues.slice(0, 3).map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
        return undefined;
      }
      return parsed.data;
    });
  } catch (error) {
    console.error("V6 source metadata unreadable:", error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

/**
 * Documents for one school, keyed by the official source URL match key. A plain
 * object, not a Map: some V6 pages pass it through client components, and only
 * plain JSON survives that boundary.
 */
export function v6SourceMetadataByUrl(slug: string): Readonly<Record<string, V6SourceDocument>> | undefined {
  const documents = loadV6SourceMetadata()?.schools[slug];
  if (!documents?.length) return undefined;
  return Object.fromEntries(documents.map((document) => [v6SourceUrlKey(document.url), document]));
}

/** Public API projection (`sourceMetadata`) for one school, or undefined. */
export function v6SourceMetadataForApi(slug: string) {
  const metadata = loadV6SourceMetadata();
  return metadata ? v6SourceMetadataProjection(metadata, slug) : undefined;
}
