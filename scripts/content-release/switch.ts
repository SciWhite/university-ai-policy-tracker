import { appendFileSync, closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeFileSync, writeSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CONTENT_POINTER_SCHEMA, type ContentPointer, type ContentReleaseManifest, type ContentSyncReceipt } from "../../apps/web/lib/content-runtime";
import { READING_LOCALES } from "../../apps/web/lib/language-catalog";
import { requirePolicySync } from "../lib/require-policy-sync";
import { readManifest, releaseDir, selectTree, sha256File } from "./lib";
import { schoolDigests, validateContentRelease, type ValidationReport } from "./validate";

const REFRESH_BATCH = 1000;

/**
 * Content switch (docs/content-release.md §Switch): validate, bind the
 * synchronization event, atomically replace current.json, then ask the
 * running web process (loopback) to expire the changed tags and paths.
 * Rollback is the same operation to an earlier release. Never builds,
 * restarts, purges Cloudflare or notifies search engines.
 */
export interface SwitchOptions {
  contentRoot: string;
  contentId: string;
  syncLedger?: string;
  unsynchronizedLocalPreview?: boolean;
  rollback?: boolean;
  refreshUrl?: string;
  siteUrl?: string;
}

interface HistoryRow { at: string; contentId: string; manifestSha256: string; previousContentId: string | null; sync?: ContentSyncReceipt; unsynchronizedLocalPreview?: true; rollback?: boolean }

const compare = (a: string, b: string) => { const [x, y] = [a, b].map(v => v.split(".").map(Number)); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

function readHistory(contentRoot: string): HistoryRow[] {
  const file = path.join(contentRoot, "pointer-history.jsonl");
  return existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line)) : [];
}

/** Tags and exact paths whose pages differ between two releases. */
export function changedSurface(previous: { manifest?: ContentReleaseManifest; digests?: Record<string, string> }, next: { manifest: ContentReleaseManifest; digests: Record<string, string>; cohort: string[] }) {
  const tags = new Set<string>(), paths = new Set<string>();
  const localized = (route: string, all: boolean) => {
    paths.add(route || "/");
    for (const locale of all ? READING_LOCALES : ["zh"]) if (locale !== "en") paths.add(`/${locale}${route}`);
  };
  const before = previous.digests ?? {};
  const schools = [...new Set([...Object.keys(before), ...Object.keys(next.digests)])].filter(slug => before[slug] !== next.digests[slug]).sort();
  const cohort = new Set(next.cohort);
  for (const slug of schools) { tags.add(`school:${slug}`); localized(`/universities/${slug}`, cohort.has(slug)); }
  const added = schools.filter(slug => !before[slug] || !next.digests[slug]);
  if (schools.length) { tags.add("catalog"); tags.add("home"); localized("", true); localized("/universities", true); }
  if (added.length) { tags.add("sitemap"); for (const p of ["/sitemap.xml", "/sitemaps/core.xml", "/sitemaps/universities.xml"]) paths.add(p); }
  const family = (name: string, m?: ContentReleaseManifest) => JSON.stringify(m?.families?.[name] ?? null);
  if (family("public-change-history", previous.manifest) !== family("public-change-history", next.manifest) || family("public-v6-change-overviews", previous.manifest) !== family("public-v6-change-overviews", next.manifest)) {
    tags.add("changes"); localized("/changes", true); paths.add("/sitemaps/changes.xml");
    const revision = next.manifest.families["public-v6-records"]?.revision;
    if (revision) tags.add(`changes:${revision}`);
    for (const slug of schools) paths.add(`/changes/${slug}`);
  }
  const reportFile = (m?: ContentReleaseManifest) => m?.files.find(([rel]) => rel === "data/monthly-reports/registry.json")?.[1];
  if (reportFile(previous.manifest) !== reportFile(next.manifest)) {
    tags.add("reports"); tags.add("home"); localized("/reports", true);
    // Both sides: a rollback removes the newer month, a release adds it.
    for (const month of new Set([previous.manifest?.reports?.current, next.manifest.reports?.current].filter((m): m is string => Boolean(m)))) {
      tags.add(`report:${month}`); localized(`/reports/monthly/${month}`, true);
      paths.add(`/api/public/v1/reports/monthly/${month}/chart-data.json`);
    }
    for (const p of ["/api-reference", "/datasets", "/feeds/reports.xml", "/feeds/atom.xml", "/llms.txt"]) paths.add(p);
    if (!tags.has("sitemap")) { tags.add("sitemap"); paths.add("/sitemaps/core.xml"); }
  }
  return { tags: [...tags].sort(), paths: [...paths].sort(), changedSchools: schools };
}

function writeAtomically(file: string, body: string) {
  const temp = `${file}.tmp-${process.pid}`;
  const fd = openSync(temp, "w", 0o644);
  try { writeSync(fd, body); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, file);
}

export async function switchContentRelease(options: SwitchOptions) {
  const { contentRoot, contentId } = options;
  const { manifest, file: manifestFile } = readManifest(contentRoot, contentId);
  const pointerFile = path.join(contentRoot, "current.json");
  const previousPointer = existsSync(pointerFile) ? JSON.parse(readFileSync(pointerFile, "utf8")) as ContentPointer : undefined;
  if (previousPointer?.contentId === contentId) throw new Error(`${contentId} is already selected`);

  const validation: ValidationReport = await validateContentRelease(contentRoot, contentId);
  if (!validation.ok) throw new Error(`Validation failed: ${validation.errors.slice(0, 5).join("; ")}`);

  // Synchronization: a new event bound to this manifest, or for rollback the receipt the release was promoted with.
  let sync: ContentSyncReceipt | undefined;
  let preview: true | undefined;
  if (options.rollback) {
    const row = readHistory(contentRoot).reverse().find(item => item.contentId === contentId && item.manifestSha256 === validation.manifestSha256);
    if (!row) throw new Error("Rollback target was never selected from this content root");
    sync = row.sync; preview = row.unsynchronizedLocalPreview;
  } else if (options.syncLedger) {
    const ledger = await requirePolicySync({ ledgerPath: options.syncLedger, basisFile: manifestFile, allowedTypes: ["policy_release"] }) as { syncContractVersion: "2.0.0" | "2.1.0"; eventId: string };
    if (compare(ledger.syncContractVersion, manifest.requiredSyncContract) < 0) throw new Error(`This content requires synchronization contract ${manifest.requiredSyncContract}`);
    sync = { contractVersion: ledger.syncContractVersion, eventId: ledger.eventId, eventSha256: sha256File(options.syncLedger) };
  } else if (options.unsynchronizedLocalPreview) {
    preview = true;
  } else {
    throw new Error("Refusing to switch without --sync-ledger (or --unsynchronized-local-preview for a local demo); see docs/policy-evidence-integration-runbook.md");
  }
  if (!sync && !preview) throw new Error("No synchronization receipt for this release");

  const pointer: ContentPointer = {
    schemaVersion: CONTENT_POINTER_SCHEMA, contentId, manifestSha256: validation.manifestSha256,
    switchedAt: new Date().toISOString(), previousContentId: previousPointer?.contentId ?? null,
    ...(sync ? { sync } : {}), ...(preview ? { unsynchronizedLocalPreview: true as const } : {})
  };
  const previousManifest = previousPointer ? readManifest(contentRoot, previousPointer.contentId).manifest : undefined;
  // Diff against the release being replaced: the parent's digests come with validation;
  // for a rollback or a skipped parent, read the active release's tree directly.
  let previousDigests = previousManifest?.contentId === manifest.parentContentId ? validation.parentSchoolDigests : undefined;
  if (previousManifest && !previousDigests) {
    selectTree(previousManifest.contentId, path.join(releaseDir(contentRoot, previousManifest.contentId), "tree"), previousManifest);
    previousDigests = await schoolDigests();
  }
  const surface = changedSurface(
    { manifest: previousManifest, digests: previousDigests },
    { manifest, digests: validation.schoolDigests ?? {}, cohort: JSON.parse(readFileSync(path.join(releaseDir(contentRoot, contentId), "tree/data/public-v6-pages/current.json"), "utf8")).slugs ?? [] }
  );
  // First selection: nothing was served from this content root yet, so there is no
  // changed-URL list; expiring the "content" tag covers every tagged route.
  const tags = previousManifest ? surface.tags : ["content"];
  if (!previousManifest) surface.paths.length = 0;

  writeAtomically(pointerFile, JSON.stringify(pointer, null, 2) + "\n");
  const row: HistoryRow = { at: pointer.switchedAt!, contentId, manifestSha256: pointer.manifestSha256, previousContentId: pointer.previousContentId ?? null, ...(sync ? { sync } : {}), ...(preview ? { unsynchronizedLocalPreview: true as const } : {}), ...(options.rollback ? { rollback: true } : {}) };
  appendFileSync(path.join(contentRoot, "pointer-history.jsonl"), JSON.stringify(row) + "\n");

  const siteUrl = options.siteUrl ?? "https://eduaipolicy.org";
  const plan = {
    schemaVersion: "uapt-content-switch-v1", contentId, previousContentId: pointer.previousContentId, switchedAt: pointer.switchedAt,
    tags, paths: surface.paths, changedSchools: surface.changedSchools,
    // Separate, authorized step: POST this body to the zone's purge_cache API. Not sent by this tool.
    cloudflarePurge: { status: "not_sent", body: { files: surface.paths.map(p => new URL(p, siteUrl).toString()) } },
    completion: "Public readback of the paths above, then python3 scripts/policy-inventory.py sync-gate <ledger> --phase complete"
  };
  const planFile = path.join(releaseDir(contentRoot, contentId), `switch-${pointer.switchedAt!.replace(/[:.]/g, "-")}.json`);
  writeFileSync(planFile, JSON.stringify(plan, null, 2) + "\n");

  let refresh: unknown = "not_requested";
  if (options.refreshUrl) {
    const url = new URL("/api/internal/content/refresh", options.refreshUrl);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("Refresh is loopback-only");
    // The endpoint bounds each request; tags go with the first batch, exact paths follow.
    const batches: { tags: string[]; paths: string[] }[] = [];
    for (let i = 0; i === 0 || i < surface.paths.length; i += REFRESH_BATCH) batches.push({ tags: i === 0 ? tags : [], paths: surface.paths.slice(i, i + REFRESH_BATCH) });
    const results: { status: number; tags: number; paths: number }[] = [];
    for (const batch of batches.filter(item => item.tags.length + item.paths.length > 0)) {
      const response = await fetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.UAPT_CONTENT_REFRESH_TOKEN ?? ""}`, "content-type": "application/json" },
        body: JSON.stringify({ expectedContentId: contentId, ...batch })
      });
      const body = await response.json().catch(() => null) as { contentId?: string; revalidated?: { tags: string[]; paths: string[] } } | null;
      if (!response.ok) throw new Error(`Pointer switched but refresh failed (${response.status}); retry the refresh or roll back: ${JSON.stringify(body)}`);
      results.push({ status: response.status, tags: body?.revalidated?.tags.length ?? 0, paths: body?.revalidated?.paths.length ?? 0 });
    }
    refresh = { contentId, batches: results };
  }
  return { pointer, planFile, tags, paths: surface.paths, changedSchools: surface.changedSchools, refresh, notes: validation.notes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
  const contentRoot = arg("--content-root") ?? process.env.UAPT_CONTENT_ROOT;
  const contentId = arg("--content-id");
  if (!contentRoot || !contentId) {
    console.error("usage: content:switch --content-root <dir> --content-id <id> (--sync-ledger <event.json> | --rollback | --unsynchronized-local-preview) [--refresh-url http://127.0.0.1:3100]");
    process.exit(2);
  }
  switchContentRelease({
    contentRoot: path.resolve(contentRoot), contentId, syncLedger: arg("--sync-ledger"),
    unsynchronizedLocalPreview: process.argv.includes("--unsynchronized-local-preview"), rollback: process.argv.includes("--rollback"),
    refreshUrl: arg("--refresh-url"), siteUrl: arg("--site-url")
  }).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}

