import pointer from "../../../data/public-change-history/current.json";
import { findRepoRoot } from "./repo-root";
import { publicHistoryBasis } from "./public-history-basis";
import { readVerifiedArtifact } from "./v6-artifact-store";
import type { ChangeRecord } from "./change-records";
import type { ReleaseDiff } from "./release-diffs";

interface HistoryFile { file: string; sha256: string; bytes: number }

interface HistoryManifest {
  schemaVersion: "uapt-public-change-history-v1";
  basisSha256: string;
  entries: Record<string, HistoryFile>;
  releases: Record<string, HistoryFile>;
}

// The published inputs are immutable for a running artifact, as are the existing
// staged dataset and release caches. New releases ship a regenerated projection.
let verifiedBasis: Promise<string> | undefined;

async function historyManifest() {
  const repoRoot = await findRepoRoot();
  verifiedBasis ??= publicHistoryBasis(repoRoot);
  const basis = await verifiedBasis;
  const root = `${repoRoot}/data/public-change-history`;
  const manifest = readVerifiedArtifact<HistoryManifest>(root, pointer.path, pointer.sha256, 2 * 1024 * 1024);
  if (manifest.schemaVersion !== "uapt-public-change-history-v1" || manifest.basisSha256 !== basis) {
    throw new Error("Public change history is out of date; regenerate with scripts/export-public-change-history.ts");
  }
  return { root, manifest };
}

export async function readPublicChangeHistory(slug: string): Promise<ChangeRecord[]> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return [];
  const { root, manifest } = await historyManifest();
  const entry = Object.hasOwn(manifest.entries, slug) ? manifest.entries[slug] : undefined;
  if (!entry) return [];
  const records = readVerifiedArtifact<ChangeRecord[]>(root, entry.file, entry.sha256, 4 * 1024 * 1024, entry.bytes);
  if (!Array.isArray(records) || records.some(record => record.slug !== slug || !Array.isArray(record.diffRows))) {
    throw new Error("Invalid public change history scope");
  }
  return structuredClone(records);
}

export async function readPublicReleaseDiff(releaseId: string): Promise<ReleaseDiff | undefined> {
  const { root, manifest } = await historyManifest();
  const entry = manifest.releases && Object.hasOwn(manifest.releases, releaseId) ? manifest.releases[releaseId] : undefined;
  if (!entry) return undefined;
  const diff = readVerifiedArtifact<ReleaseDiff>(root, entry.file, entry.sha256, 32 * 1024 * 1024, entry.bytes);
  if (diff.releaseId !== releaseId || !Array.isArray(diff.entities)) throw new Error("Invalid public release diff scope");
  return structuredClone(diff);
}
