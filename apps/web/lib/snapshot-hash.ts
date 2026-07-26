// The full hash stays available in the title attribute and in public JSON;
// eight hex characters are enough to eyeball-match snapshots on the page.
export function formatSnapshotHash(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 8)}…` : hash;
}
