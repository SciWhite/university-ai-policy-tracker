import { getRankingEdition, rankingEditions } from "./ranking-editions";
export type DiscoveryMode = "universities" | "rankings";
export type DiscoverySearchParams = Record<
  string,
  string | string[] | undefined
>;
export interface DiscoveryQuery {
  edition: string;
  q: string;
  country: string;
  topics: string[];
  sort: string;
  order: "asc" | "desc";
  page: number;
  size: number;
  scope: string;
  coverage: string;
  view: string;
  compare: string[];
}
export const legacyRankingEditions: Record<string, string> = {
  qs: "qs-2026",
  the: "the-2026",
  arwu: "arwu-2025",
  usnews: "usnews-2025-2026",
  cwts: "cwts-leiden-2025",
};
export const defaultDiscoveryQuery = (mode: DiscoveryMode): DiscoveryQuery => ({
  edition: "qs-2027",
  q: "",
  country: "",
  topics: [],
  sort: mode === "rankings" ? "rank" : "name",
  order: "asc",
  page: 1,
  size: 25,
  scope: mode === "universities" ? "policy" : "all",
  coverage: "all",
  view: "grid",
  compare: [],
});
export const pageSizes = [10, 25, 50, 100];
export function parseDiscoveryQuery(
  input: DiscoverySearchParams,
  mode: DiscoveryMode,
  fixedEdition?: string,
): DiscoveryQuery {
  const one = (key: string) => {
    const v = input[key];
    return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
  };
  const integer = (key: string, fallback: number) =>
    /^\d+$/.test(one(key)) &&
    Number.isSafeInteger(Number(one(key))) &&
    Number(one(key)) > 0
      ? Number(one(key))
      : fallback;
  const legacy = legacyRankingEditions[one("ranking")];
  return {
    edition:
      fixedEdition ??
      getRankingEdition(one("edition"))?.slug ??
      legacy ??
      "qs-2027",
    q: one("q").slice(0, 200),
    country: one("country"),
    topics: [...new Set([input.topic ?? []].flat())],
    sort:
      one("sort") === "updated"
        ? "recent"
        : ["rank", "name", "recent", "claims", "sources"].includes(one("sort"))
          ? one("sort")
          : mode === "rankings"
            ? "rank"
            : "name",
    order:
      one("order") === "desc"
        ? "desc"
        : one("order") === "asc"
          ? "asc"
          : ["recent", "claims", "sources"].includes(one("sort"))
            ? "desc"
            : "asc",
    page: integer("page", 1),
    size: pageSizes.includes(integer("size", 25)) ? integer("size", 25) : 25,
    scope: ["all", "policy", "ranking-only"].includes(one("scope"))
      ? one("scope")
      : mode === "universities"
        ? "policy"
        : "all",
    coverage:
      mode === "rankings"
        ? "all"
        : ["ranked", "missing"].includes(one("coverage"))
          ? one("coverage")
          : "all",
    view: mode === "universities" && one("view") === "list" ? "list" : "grid",
    compare: one("compare")
      .split(",")
      .filter((s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s))
      .slice(0, 4),
  };
}
export function discoveryQueryString(
  query: DiscoveryQuery,
  mode: DiscoveryMode = "rankings",
  fixedEdition?: string,
) {
  const defaults = defaultDiscoveryQuery(mode),
    p = new URLSearchParams();
  for (const key of [
    "edition",
    "q",
    "country",
    "sort",
    "order",
    "page",
    "size",
    "scope",
    "coverage",
    "view",
  ] as const) {
    if (key === "edition" && fixedEdition) continue;
    if (mode === "rankings" && (key === "coverage" || key === "view")) continue;
    if (query[key] !== defaults[key]) p.set(key, String(query[key]));
  }
  for (const topic of query.topics) p.append("topic", topic);
  if (query.compare.length) p.set("compare", query.compare.join(","));
  return p.size ? "?" + p : "";
}
/** Return links are restricted to the two discovery surfaces and known locales. */
export function safeDiscoveryReturn(value: string | null): string | null {
  if (
    !value ||
    value.length > 4096 ||
    /[\\\u0000-\u0020\u007f]/.test(value) ||
    !/^\/(?:en\/|zh\/|fr\/|pl\/|es\/|nl\/|ms\/)?(?:universities|rankings)(?:\/[-a-z0-9]+)?(?:\?|$)/.test(
      value,
    )
  )
    return null;
  try {
    const url = new URL(value, "https://discovery.invalid");
    if (url.origin !== "https://discovery.invalid" || url.hash) return null;
    const path = url.pathname.replace(/^\/(?:en|zh|fr|pl|es|nl|ms)(?=\/)/, "");
    if (
      path === "/universities" ||
      path === "/rankings" ||
      (path.startsWith("/rankings/") && getRankingEdition(path.slice(10)))
    )
      return url.pathname + url.search;
  } catch {}
  return null;
}
