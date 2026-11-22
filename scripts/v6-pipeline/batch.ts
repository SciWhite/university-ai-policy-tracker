// TypeScript side of scripts/v6-pipeline/v6batch.py: the batch workspace and its batch.json.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface BatchSchool { slug: string; rank: string | number; abbr: string; language: string }
export interface Batch {
  schemaVersion: "uapt-v6-batch-v1"; batchId: string; mode: "add" | "update"; revision: string; contentId?: string;
  parentRelease: string; schools: BatchSchool[]; englishOnlySlugs?: string[]; reviewDir?: string; outDir?: string;
  sourceMetadataFile?: string; changeSummary?: { en: string; zh: string }; pageUpdate?: string;
  deploymentAuthorizedBy?: string | null; deploymentNote?: string; rankingEdition?: string;
}

export function workspaceFromArgv(argv = process.argv.slice(2)) {
  const args = [...argv];
  let ws = process.env.UAPT_V6_WORKSPACE;
  const i = args.indexOf("--workspace");
  if (i >= 0) { ws = args[i + 1]; args.splice(i, 2); }
  if (!ws) throw Error("Pass --workspace <batch dir> or set UAPT_V6_WORKSPACE");
  return { ws: path.resolve(ws), args };
}

export function loadBatch(ws: string): Batch {
  const file = path.join(ws, "batch.json");
  if (!existsSync(file)) throw Error(`No batch.json in ${ws}`);
  const batch = JSON.parse(readFileSync(file, "utf8")) as Batch;
  if (batch.schemaVersion !== "uapt-v6-batch-v1" || !batch.batchId || !batch.revision || !["add", "update"].includes(batch.mode)) throw Error("Invalid batch.json (schemaVersion, batchId, revision, mode)");
  if (!Array.isArray(batch.schools) || !batch.schools.length) throw Error("batch.json needs schools");
  if (!batch.parentRelease) throw Error("batch.json needs parentRelease (a release directory with manifest.json and tree/)");
  batch.parentRelease = path.resolve(ws, batch.parentRelease);
  return batch;
}

export const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

/** Refuse unless gates/<name>.json passed (gates.py) and its inputs hash is recorded. */
export function requireGatePassed(ws: string, name: string) {
  const file = path.join(ws, "gates", `${name}.json`);
  const gate = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  if (!gate || gate.status !== "pass") throw Error(`Gate ${name} has not passed; run python3 scripts/v6-pipeline/gates.py --workspace ${ws} ${name}`);
  return gate as { inputsSha256: string; checkedAt: string };
}
