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

/** Additive v2 basis: retain the complete v1 basis and bind the event inputs/rules. */
export async function publicHistoryBasisV2(repoRoot: string) {
  const files = [
    "data/public-v6-pages/revisions.json", "data/public-v6-records/revisions.json",
    "data/public-v6-pages/sharded/index.json", "data/public-v6-records/sharded/index.json",
    "data/public-v6-history/sharded/index.json",
    "apps/web/lib/change-events.ts", "apps/web/lib/change-event-rules.ts",
    "apps/tulsa-zone/components/v6-compact-change-note.tsx",
    "apps/tulsa-zone/components/mit-student-guide-change-note.tsx",
    "apps/tulsa-zone/components/imperial-ux-change-note.tsx"
  ];
  async function visit(dir: string): Promise<string[]> {
    return (await Promise.all((await readdir(path.join(repoRoot,dir),{withFileTypes:true})).map(e=>e.isDirectory()?visit(`${dir}/${e.name}`):Promise.resolve([`${dir}/${e.name}`])))).flat();
  }
  files.push(...await visit("data/public-v6-history/repairs"));
  const hashes = await Promise.all(files.sort().map(async file=>[file,createHash("sha256").update(await readFile(path.join(repoRoot,file))).digest("hex")]));
  return createHash("sha256").update(JSON.stringify({legacyBasis:await publicHistoryBasis(repoRoot),files:hashes})).digest("hex");
}
