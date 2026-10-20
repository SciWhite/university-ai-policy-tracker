import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildPublicHistoryProjection } from "../apps/web/lib/change-records";
import { publicHistoryBasis } from "../apps/web/lib/public-history-basis";
import { findRepoRoot } from "../apps/web/lib/repo-root";

const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
async function main() {
  if (process.env.UAPT_PUBLIC_RELEASE_MANIFEST || process.env.UAPT_CANDIDATE_REPAIR_SLUG || process.env.UAPT_PRIVATE_SNAPSHOT_DIFF_ROOT) {
    throw Error("Public history export requires the current published inputs, without private candidate overrides");
  }
  // All payloads come from the existing public diff builder, never raw inventory.
  process.env.NEXT_PUBLIC_SITE_URL = "https://eduaipolicy.org";
  const repoRoot = await findRepoRoot();
  const basisSha256 = await publicHistoryBasis(repoRoot);
  const { histories: rows, releases } = await buildPublicHistoryProjection();
  const root = path.join(repoRoot, "data/public-change-history");
  const entries: Record<string, { file: string; sha256: string; bytes: number }> = {};
  await mkdir(path.join(root, "objects"), { recursive: true });
  for (const [slug, records] of Object.entries(rows).sort(([a], [b]) => a.localeCompare(b))) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || records.some(record => record.slug !== slug)) throw Error("History scope mismatch");
    const raw = JSON.stringify(records);
    const sha256 = hash(raw);
    const bytes = Buffer.byteLength(raw);
    if (bytes > 4 * 1024 * 1024) throw Error(`History shard too large: ${slug}`);
    const file = `objects/${sha256}.json`;
    await writeFile(path.join(root, file), raw);
    entries[slug] = { file, sha256, bytes };
  }
  const releaseEntries: typeof entries = {};
  for (const [releaseId, diff] of Object.entries(releases)) {
    const raw = JSON.stringify(diff);
    const sha256 = hash(raw);
    const bytes = Buffer.byteLength(raw);
    if (bytes > 32 * 1024 * 1024) throw Error(`Release shard too large: ${releaseId}`);
    const file = `objects/${sha256}.json`;
    await writeFile(path.join(root, file), raw);
    releaseEntries[releaseId] = { file, sha256, bytes };
  }
  if (await publicHistoryBasis(repoRoot) !== basisSha256) throw Error("History inputs changed during export");
  const manifest = JSON.stringify({ schemaVersion: "uapt-public-change-history-v1", basisSha256, entries, releases: releaseEntries });
  const sha256 = hash(manifest);
  const file = `manifest-${sha256}.json`;
  await writeFile(path.join(root, file), manifest);
  await writeFile(path.join(root, "current.json.next"), JSON.stringify({ path: file, sha256 }, null, 2) + "\n");
  await rename(path.join(root, "current.json.next"), path.join(root, "current.json"));
  console.log(JSON.stringify({ universitiesWithHistoricalChanges: Object.keys(entries).length, records: Object.values(rows).reduce((n, r) => n + r.length, 0), releases: Object.keys(releaseEntries).length, bytes: [...Object.values(entries), ...Object.values(releaseEntries)].reduce((n, r) => n + r.bytes, 0), basisSha256, sha256 }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
