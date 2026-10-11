import { isDeepStrictEqual } from "node:util";

interface ReleaseIdentity {
  releaseId: string;
  publishedAt: string;
  previousReleaseId?: string;
}

/** Identical archived copies are one release; conflicting identities fail closed. */
export function validatePublishedReleaseChain<T extends ReleaseIdentity>(
  current: T,
  history: Array<{ manifest: T; path: string }>,
): { published: T[]; identicalCopies: number } {
  const unique = new Map<string, { manifest: T; path: string }>();
  let identicalCopies = 0;
  for (const item of [...history, { manifest: current, path: "current.json" }]) {
    const previous = unique.get(item.manifest.releaseId);
    if (previous) {
      if (!isDeepStrictEqual(previous.manifest, item.manifest)) {
        throw Error(`Conflicting manifests for release ${item.manifest.releaseId}: ${previous.path} and ${item.path}.`);
      }
      identicalCopies += 1;
    } else unique.set(item.manifest.releaseId, item);
  }
  const published = [...unique.values()].map((item) => item.manifest)
    .sort((left, right) => left.publishedAt.localeCompare(right.publishedAt));
  if (published.at(-1)?.releaseId !== current.releaseId) {
    throw Error(`Current release ${current.releaseId} is not the latest published manifest by publishedAt.`);
  }
  for (let index = 0; index < published.length; index += 1) {
    const manifest = published[index];
    if (!manifest.previousReleaseId) continue;
    if (manifest.previousReleaseId === manifest.releaseId) throw Error(`Published release ${manifest.releaseId} points to itself.`);
    if (!unique.has(manifest.previousReleaseId)) {
      throw Error(`Published release ${manifest.releaseId} points to unknown previous release ${manifest.previousReleaseId}.`);
    }
    const previous = published[index - 1]?.releaseId;
    if (previous && manifest.previousReleaseId !== previous) {
      throw Error(`Published release ${manifest.releaseId} points to ${manifest.previousReleaseId}; chronological previous release is ${previous}.`);
    }
  }
  return { published, identicalCopies };
}
