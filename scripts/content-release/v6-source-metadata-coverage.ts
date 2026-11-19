/**
 * V6 source-metadata delivery gate.
 *
 * Every official source of every published V6 school needs a record in
 * `data/public-v6-source-metadata.json`: a document (issuer, dates, approver,
 * each with a verbatim quote; empty when the text states none) or a
 * `fetch_failed` gap with the date it was tried. The pairs the first bulk run
 * (2026-11-18) never processed are frozen in
 * `v6-source-metadata-legacy-unprocessed.json`; that list only shrinks.
 *
 * Usage (reads the active content: the checkout's data/ or UAPT_CONTENT_ROOT):
 *   pnpm validate:v6-source-metadata [--metadata <file>]
 *   pnpm validate:v6-source-metadata --targets <new.json> [--slugs a,b] [--retry-failed]
 * The second form lists the sources still to process, as input for
 * `python3 scripts/v6-source-metadata.py targets --gate <new.json>`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { V6_SOURCE_METADATA_FILE, v6SourceMetadataCoverage, v6SourceMetadataSchema, v6SourceUrlKey, type V6SourceMetadata } from "../../packages/shared/src/v6-source-metadata";
import { readContentJson } from "../../apps/web/lib/content-runtime";
import { readPublishedV6 } from "../../apps/web/lib/policy-v6-published";
import { v6CorrectedSummary } from "../../apps/web/lib/v6-effective-records";

const LEGACY_FILE = new URL("./v6-source-metadata-legacy-unprocessed.json", import.meta.url);

export interface LegacyUnprocessed { schemaVersion: "uapt-v6-source-metadata-legacy-unprocessed-v1"; frozenOn: string; reason: string; schools: Record<string, string[]> }

export function legacyUnprocessed(): LegacyUnprocessed {
  return JSON.parse(readFileSync(LEGACY_FILE, "utf8")) as LegacyUnprocessed;
}

/** Official source URLs of every published V6 school, as the university API serves them. */
export function v6OfficialSourceUrls(): Record<string, string[]> {
  const pages = readPublishedV6();
  if (!pages) throw new Error("No published V6 pages");
  const out: Record<string, string[]> = {};
  for (const slug of pages.slugs) {
    const summary = v6CorrectedSummary(slug);
    if (!summary) throw new Error(`V6 school ${slug} has no effective record`);
    out[slug] = [...new Set(summary.officialSources.map((source) => source.sourceUrl))].sort();
  }
  return out;
}

/** Schema plus coverage for the active content. A missing file fails: V6 pages need it. */
export function checkV6SourceMetadata(metadataFile?: string) {
  const raw = metadataFile ? JSON.parse(readFileSync(metadataFile, "utf8")) : readContentJson<unknown>(V6_SOURCE_METADATA_FILE, { optional: true, maxBytes: 16 * 1024 * 1024 });
  if (raw === undefined || raw === null) return { errors: [`${V6_SOURCE_METADATA_FILE} is missing; every V6 release needs it`], stats: undefined };
  const parsed = v6SourceMetadataSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.issues.slice(0, 20).map((issue) => `${V6_SOURCE_METADATA_FILE}: ${issue.path.join(".")}: ${issue.message}`), stats: undefined };
  return v6SourceMetadataCoverage(parsed.data as V6SourceMetadata, v6OfficialSourceUrls(), legacyUnprocessed().schools);
}

/**
 * Official sources of published V6 schools that still lack a document record:
 * no record at all, a legacy-unprocessed pair, or (with `retryFailed`) a
 * fetch_failed gap. Input for `scripts/v6-source-metadata.py fetch`.
 */
export function v6SourceMetadataTargets(metadata: V6SourceMetadata | undefined, slugs?: readonly string[], retryFailed = false) {
  const official = v6OfficialSourceUrls();
  const wanted = slugs?.length ? slugs : Object.keys(official);
  const targets: { slug: string; url: string; reason: "missing" | "legacy_unprocessed" | "fetch_failed" }[] = [];
  const legacy = legacyUnprocessed().schools;
  for (const slug of wanted) {
    if (!official[slug]) throw new Error(`${slug} is not a published V6 school; pass its official sources to the pipeline with --view`);
    const documented = new Set((metadata?.schools[slug] ?? []).map((document) => v6SourceUrlKey(document.url)));
    const failed = new Set((metadata?.gaps?.[slug] ?? []).map((gap) => v6SourceUrlKey(gap.url)));
    for (const url of official[slug]) {
      const key = v6SourceUrlKey(url);
      if (documented.has(key)) continue;
      if (failed.has(key)) { if (retryFailed) targets.push({ slug, url, reason: "fetch_failed" }); continue; }
      targets.push({ slug, url, reason: (legacy[slug] ?? []).includes(key) ? "legacy_unprocessed" : "missing" });
    }
  }
  return targets;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.env.UAPT_V6_PUBLISHED_PAGES ??= "1";
  const args = process.argv.slice(2);
  if (args[0] === "--targets") {
    // --targets <out.json> [--slugs a,b] [--retry-failed]
    const out = args[1];
    if (!out) throw new Error("Usage: validate:v6-source-metadata --targets <out.json> [--slugs a,b] [--retry-failed]");
    const slugs = args.includes("--slugs") ? args[args.indexOf("--slugs") + 1]?.split(",").filter(Boolean) : undefined;
    const raw = readContentJson<unknown>(V6_SOURCE_METADATA_FILE, { optional: true, maxBytes: 16 * 1024 * 1024 });
    const metadata = raw ? v6SourceMetadataSchema.parse(raw) as V6SourceMetadata : undefined;
    const targets = v6SourceMetadataTargets(metadata, slugs, args.includes("--retry-failed"));
    writeFileSync(out, JSON.stringify({ schemaVersion: "uapt-v6-source-metadata-targets-v1", targets }, null, 1) + "\n", { flag: "wx" });
    console.log(JSON.stringify({ targets: targets.length, schools: new Set(targets.map((target) => target.slug)).size, out }));
    process.exit(0);
  }
  const metadata = args[0] === "--metadata" ? args[1] : undefined;
  if (args.length && !(args.length === 2 && metadata)) throw new Error("Usage: validate:v6-source-metadata [--metadata <file>] | --targets <out.json> [--slugs a,b] [--retry-failed]");
  const result = checkV6SourceMetadata(metadata);
  console.log(JSON.stringify({ ok: result.errors.length === 0, ...result.stats, errors: result.errors.slice(0, 50), moreErrors: Math.max(0, result.errors.length - 50) }, null, 2));
  if (result.errors.length) process.exitCode = 1;
}
