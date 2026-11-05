import { activeContent } from "./content-runtime";

/**
 * Root with the repository data layout for the active content release: the
 * release tree under UAPT_CONTENT_ROOT, or (workspace mode) `.runtime-data` /
 * the source checkout as before R1-b. Resolved per request, never at build.
 */
export async function findRepoRoot(): Promise<string> {
  return activeContent().root;
}
