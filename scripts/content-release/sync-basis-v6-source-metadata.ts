/**
 * Frozen basis artifacts for the content release that adds
 * data/public-v6-source-metadata.json (contract 2.1.0, candidate phase).
 *
 * Usage (release mode, preview pointer on the new release):
 *   UAPT_CONTENT_ROOT=<root> UAPT_CONTENT_ALLOW_UNSYNCHRONIZED=1 \
 *   tsx --tsconfig apps/web/tsconfig.json scripts/content-release/sync-basis-v6-source-metadata.ts \
 *     <out-dir> <basis-sha256> <proof-projection-manifest.json> <window.json>
 *
 * Writes public-data.json (the public summaries the change events were built
 * from), scope.json (every school with metadata, full Claim ID sets, changed
 * revisions exactly as the projection validator derives them) and the six
 * event-surface files restricted to that scope. It reads only the active
 * content release; it does not observe HTTP routes (the readback does).
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { v6CorrectedSummary } from "../../apps/web/lib/v6-effective-records";
import { ChangeEventStore } from "../../apps/web/lib/public-change-history";
import { buildEventHistories, eventPreview, eventHash } from "../../apps/web/lib/change-events";
import { scopedEventWindow } from "../validate-change-event-projection";
import { V6_SOURCE_METADATA_FILE, v6SourceMetadataSchema } from "../../packages/shared/src/v6-source-metadata";
import { activeContent, contentPath } from "../../apps/web/lib/content-runtime";
import { SUPPORTED_LOCALES } from "../../apps/web/lib/i18n";

const [outDir, basisSha256, projectionFile, windowFile] = process.argv.slice(2);
if (!outDir || !/^[a-f0-9]{64}$/.test(basisSha256 ?? "") || !projectionFile || !windowFile) throw Error("usage: <out-dir> <basis-sha256> <projection-manifest> <window.json>");
const write = (name: string, value: unknown) => { const raw = JSON.stringify(value, null, 1) + "\n"; writeFileSync(resolve(outDir, name), raw); return createHash("sha256").update(raw).digest("hex"); };

async function main() {
  const content = activeContent();
  const metadata = v6SourceMetadataSchema.parse(JSON.parse(readFileSync(contentPath(V6_SOURCE_METADATA_FILE), "utf8")));
  const slugs = Object.keys(metadata.schools).sort();
  const projectionRaw = readFileSync(projectionFile);
  const projectionSha256 = createHash("sha256").update(projectionRaw).digest("hex");
  const projectionManifest = JSON.parse(projectionRaw.toString("utf8")) as { basisSha256: string };
  const store = new ChangeEventStore(dirname(resolve(projectionFile)), { path: basename(projectionFile), sha256: projectionSha256 }, projectionManifest.basisSha256);
  const input = store.input(), expected = buildEventHistories(input);

  const summaries = [];
  const changedRevisionsBySlug: Record<string, string[]> = {};
  for (const slug of slugs) {
    const summary = v6CorrectedSummary(slug);
    if (!summary) throw Error(`No public summary: ${slug}`);
    const school = input.schools[slug], history = expected[slug];
    if (!school || school.currentRecordSha256 !== eventHash(summary)) throw Error(`Summary does not match the change basis: ${slug}`);
    changedRevisionsBySlug[slug] = school.currentRevision === input.revision && history.events.some((e) => e.revision === input.revision) ? [input.revision] : [];
    summaries.push(summary);
  }
  const dataSha256 = write("public-data.json", summaries);

  const wantedIndex = Object.values(expected).flatMap((h) => h.events.map((e) => ({ ...eventPreview(e), slug: h.slug })))
    .sort((a, b) => (Date.parse(b.publishedAt ?? "") || 0) - (Date.parse(a.publishedAt ?? "") || 0) || a.id.localeCompare(b.id));
  const scopeSet = new Set(slugs);
  const window = JSON.parse(readFileSync(windowFile, "utf8")) as { start: string; end: string; limit: number };
  const inScope = wantedIndex.filter((e) => scopeSet.has(e.slug));
  const surfaces: Record<string, string[]> = {
    history: inScope.map((e) => e.id),
    universityChanges: inScope.map((e) => e.id),
    changesIndex: inScope.map((e) => e.id),
    latestDiff: slugs.flatMap((slug) => inScope.filter((e) => e.slug === slug).slice(0, 1))
      .sort((a, b) => (Date.parse(b.publishedAt ?? "") || 0) - (Date.parse(a.publishedAt ?? "") || 0) || a.id.localeCompare(b.id)).map((e) => e.id),
    recentChanges: scopedEventWindow(wantedIndex, scopeSet, window).map((e) => e.id),
    rss: scopedEventWindow(wantedIndex, scopeSet, window).map((e) => e.id),
  };
  const surfaceHashes: Record<string, string> = {};
  for (const [name, eventIds] of Object.entries(surfaces)) {
    surfaceHashes[name] = write(`${name}-events.json`, {
      schemaVersion: "uapt-change-event-surface-v1", surface: name, checkedSlugs: slugs, projectionSha256,
      rulesVersion: input.rulesVersion,
      observationMode: "Frozen projection, byte-identical to the parent release; verified against candidate route readback (see http.json).",
      ...(name === "recentChanges" || name === "rss" ? { window } : {}),
      eventIds,
    });
  }
  const scopeSha256 = write("scope.json", {
    schemaVersion: "uapt-policy-sync-scope-v1",
    universities: summaries.map((s) => ({ slug: s.entity.slug, publicClaimIds: s.claims.map((c) => c.id!).sort() })),
    changedRevisionsBySlug,
    changedUrls: slugs.flatMap((slug) => [...SUPPORTED_LOCALES.map((l) => `${l === "en" ? "" : `/${l}`}/universities/${slug}`), `/api/public/v1/universities/${slug}.json`]).sort(),
    policyScopeMeaning: "Source-metadata release. Adds data/public-v6-source-metadata.json (agent-reviewed document type, dates and issuing/approving bodies for official sources) for every school listed. Public Claim IDs, claim text, evidence, the change projection and the MCP catalog are byte-identical to the parent release; no policy rule changed.",
  });
  process.stdout.write(JSON.stringify({ contentId: content.contentId, schools: slugs.length, claims: summaries.reduce((n, s) => n + s.claims.length, 0), dataSha256, scopeSha256, projectionSha256, inputBasisSha256: projectionManifest.basisSha256, revision: input.revision, rulesVersion: input.rulesVersion, surfaceHashes, events: Object.fromEntries(Object.entries(surfaces).map(([k, v]) => [k, v.length])), changedSchools: Object.values(changedRevisionsBySlug).filter((v) => v.length).length }) + "\n");
}
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
