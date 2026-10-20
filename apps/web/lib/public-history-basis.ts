import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/** Published release identities, alias joins and ranking inputs determine the projection. */
export async function publicHistoryBasis(repoRoot: string) {
  const files = [
    "data/public-releases/current.json",
    "data/entity-aliases.json",
    "data/public-v6-pages/current.json",
    "data/public-v6-records/current.json",
    "data/public-v6-history/current.json",
    "data/public-record-repairs/change-log.json",
    ...(await readdir(path.join(repoRoot, "data/public-releases/history")))
      .filter(name => name.endsWith(".json"))
      .map(name => `data/public-releases/history/${name}`),
    ...(await readdir(path.join(repoRoot, "data/rankings")))
      .filter(name => name.endsWith(".json"))
      .map(name => `data/rankings/${name}`)
  ].sort();
  const hashes = await Promise.all(files.map(async file => [
    file, createHash("sha256").update(await readFile(path.join(repoRoot, file))).digest("hex")
  ]));
  return createHash("sha256").update(JSON.stringify(hashes)).digest("hex");
}
