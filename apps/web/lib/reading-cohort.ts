/**
 * Client-safe view of the published V6 reading cohort (schools with the
 * additional reading locales). The server side resolves it from the active
 * content release; browsers receive it from the root document, so a content
 * switch never needs a program build. No Node built-ins here.
 */
type Resolver = () => readonly string[];
const SERVER_KEY = Symbol.for("uapt.readingCohort.server");

let clientSlugs: readonly string[] = [];
let clientSet: ReadonlySet<string> = new Set();

/** Called by content-runtime (server) at module load. */
export function registerServerReadingCohort(resolver: Resolver) {
  (globalThis as Record<symbol, unknown>)[SERVER_KEY] = resolver;
}

/** Called by the root document's bootstrap before client components render. */
export function setClientReadingCohort(slugs: readonly string[]) {
  if (typeof window === "undefined" || slugs === clientSlugs) return;
  clientSlugs = slugs;
  clientSet = new Set(slugs);
}

type NodeProcess = { getBuiltinModule?: (id: string) => unknown; cwd(): string; env: Record<string, string | undefined> };

/**
 * Node processes that never load content-runtime (scripts, tests) read the same
 * pointer unverified; the Next server registers the verified resolver at startup
 * (instrumentation.ts). getBuiltinModule keeps Node built-ins out of browser bundles.
 */
function unregisteredServerCohort(): readonly string[] {
  const proc = (globalThis as { process?: NodeProcess }).process;
  const builtin = proc?.getBuiltinModule;
  if (!proc || !builtin) return [];
  const fs = builtin("node:fs") as typeof import("node:fs");
  const path = builtin("node:path") as typeof import("node:path");
  const root = proc.env.UAPT_CONTENT_ROOT?.trim();
  const file = root
    ? path.join(root, "releases", (JSON.parse(fs.readFileSync(path.join(root, "current.json"), "utf8")) as { contentId: string }).contentId, "tree/data/public-v6-pages/current.json")
    : path.resolve(proc.cwd(), /\/apps\/(web|tulsa-zone)$/.test(proc.cwd()) ? "../../data" : "data", "public-v6-pages/current.json");
  return (JSON.parse(fs.readFileSync(file, "utf8")) as { slugs?: string[] }).slugs ?? [];
}

export function readingCohortSlugs(): readonly string[] {
  if (typeof window !== "undefined") return clientSlugs;
  const resolver = (globalThis as Record<symbol, unknown>)[SERVER_KEY] as Resolver | undefined;
  return resolver ? resolver() : unregisteredServerCohort();
}

export function isReadingCohortSchool(slug: string): boolean {
  if (typeof window !== "undefined") return clientSet.has(slug);
  return readingCohortSlugs().includes(slug);
}
