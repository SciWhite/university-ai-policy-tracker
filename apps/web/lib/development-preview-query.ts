/**
 * Preview query flags (`?layout=`, `?for=`) exist only under `next dev`.
 * Awaiting `searchParams` makes Next render the page per request with
 * `Cache-Control: private, no-store`, so production public pages must never
 * read it: they render their public layout statically and stay ISR/CDN
 * cacheable. Next inlines NODE_ENV, so the production branch never touches
 * the promise.
 */
export async function readDevelopmentPreviewQuery<T>(
  searchParams: Promise<T> | undefined,
  environment = process.env.NODE_ENV,
): Promise<T | undefined> {
  if (environment !== "development") return undefined;
  return (await searchParams) ?? ({} as T);
}
