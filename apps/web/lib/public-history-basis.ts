import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { CHANGE_RULES_VERSION } from "./change-event-rules";

/**
 * Renderer identity bound into the v2 basis. Before R1-b the basis hashed the
 * running program's source files, which tied published history to one build.
 * The values are now the frozen source identity each rules version was
 * published with, so program builds that keep the rules version keep the
 * basis. Changing event semantics means a new CHANGE_RULES_VERSION, a new entry
 * here, and a regenerated history package (sync contract 2.1.0).
 */
export const CHANGE_RENDERER_IDENTITIES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "tracker-events-1.2.0": {
    "apps/web/lib/change-events.ts": "cf787cccb9476676c91a8afced666090e62946bb34b82a77fe62a34b72217bd8",
    "apps/web/lib/change-event-rules.ts": "c8189c8f9499904e745ea71a0651d99cc9da1e71c6ff716fa9b18b4facc5ced9",
    "apps/tulsa-zone/components/v6-compact-change-note.tsx": "70f94412011ec7be19e66c04696f520df57b4b37c65a413450cc23180bdc2a6f",
    "apps/tulsa-zone/components/mit-student-guide-change-note.tsx": "2f1498e6d1a4ce07dbc3ce7fd1c2c02742e640789be8092cf71558498f4e2a69",
    "apps/tulsa-zone/components/imperial-ux-change-note.tsx": "7db4e685614adfe3b82adda608b76efcfe417ba25b89750932f1875c7fe484d5"
  }
};

export function changeRendererIdentity(rulesVersion = CHANGE_RULES_VERSION): Readonly<Record<string, string>> {
  const identity = Object.hasOwn(CHANGE_RENDERER_IDENTITIES, rulesVersion) ? CHANGE_RENDERER_IDENTITIES[rulesVersion] : undefined;
  if (!identity) throw new Error(`No frozen renderer identity for change rules ${rulesVersion}`);
  return identity;
}

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

/** Additive v2 basis: retain the complete v1 basis and bind the event inputs and renderer identity. */
export async function publicHistoryBasisV2(repoRoot: string, rulesVersion = CHANGE_RULES_VERSION) {
  const renderer = changeRendererIdentity(rulesVersion);
  const files = [
    "data/public-v6-pages/revisions.json", "data/public-v6-records/revisions.json",
    "data/public-v6-pages/sharded/index.json", "data/public-v6-records/sharded/index.json",
    "data/public-v6-history/sharded/index.json"
  ];
  async function visit(dir: string): Promise<string[]> {
    return (await Promise.all((await readdir(path.join(repoRoot,dir),{withFileTypes:true})).map(e=>e.isDirectory()?visit(`${dir}/${e.name}`):Promise.resolve([`${dir}/${e.name}`])))).flat();
  }
  files.push(...await visit("data/public-v6-history/repairs"));
  // Same ordered [file, sha256] list as before; renderer entries come from the frozen identity.
  const hashes = await Promise.all([...files, ...Object.keys(renderer)].sort().map(async file=>[file,Object.hasOwn(renderer,file)?renderer[file]:createHash("sha256").update(await readFile(path.join(repoRoot,file))).digest("hex")]));
  return createHash("sha256").update(JSON.stringify({legacyBasis:await publicHistoryBasis(repoRoot),files:hashes})).digest("hex");
}
