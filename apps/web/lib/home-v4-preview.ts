/**
 * Checks whether Home V4 local preview is active.
 * Browser-safe: has no Node.js or crypto dependencies so client components
 * like LanguageSwitcher can safely import it.
 * Fails closed in production and for any query parameter value other than "home-v4".
 */
export function isHomeV4Preview(
  layout: unknown,
  environment: string = process.env.NODE_ENV
): boolean {
  return environment === "development" && layout === "home-v4";
}
