import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { publicEntitySummarySchema } from "@uapt/shared";
import { findRepoRoot } from "./repo-root";

export interface RecordCorrectionChange {
  slug: string;
  revision: string;
  publishedAt: string;
  recordSha256: string;
  baselineClaimsFingerprint: string;
  pinFile: string;
  previousReleaseId: string;
  publicationKind: "scoped_record_correction";
  summary: string;
}

// A published policy correction and its change log are one hash-bound unit.
export async function readRecordCorrectionChanges(repoRoot?: string) {
  const root = path.join(repoRoot ?? await findRepoRoot(), "data/public-record-repairs");
  const journal = JSON.parse(await readFile(path.join(root, "change-log.json"), "utf8"));
  if (journal.schemaVersion !== "uapt-record-correction-changes-v1" || !Array.isArray(journal.entries)) throw new Error("Invalid record correction change log");
  const entries = journal.entries as RecordCorrectionChange[];
  if (new Set(entries.map(entry => entry.revision)).size !== entries.length) throw new Error("Duplicate correction change revision");
  for (const pinFile of ["current.json", "imperial-current.json"]) {
    const pin = JSON.parse(await readFile(path.join(root, pinFile), "utf8"));
    const entry = entries.find(item => item.pinFile === pinFile && item.revision === pin.revision);
    if (!entry || entry.slug !== pin.slug || entry.publishedAt !== pin.publishedAt || entry.recordSha256 !== pin.recordSha256 || entry.baselineClaimsFingerprint !== pin.baselineClaimsFingerprint || entry.publicationKind !== "scoped_record_correction" || !entry.summary || !entry.previousReleaseId || pin.publicationApproved !== true) throw new Error(`Published policy repair requires a synchronized change log: ${pin.slug}`);
  }
  for (const entry of entries) {
    if (!/^[a-z0-9-]+$/.test(entry.revision) || !Number.isFinite(Date.parse(entry.publishedAt))) throw new Error("Invalid correction change identity");
    const bytes = await readFile(path.join(root, entry.revision, "record.json"));
    if (createHash("sha256").update(bytes).digest("hex") !== entry.recordSha256) throw new Error("Correction change log record hash mismatch");
    if (publicEntitySummarySchema.parse(JSON.parse(bytes.toString())).entity.slug !== entry.slug) throw new Error("Correction change log scope mismatch");
  }
  return entries.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function readRecordCorrectionSummary(entry: RecordCorrectionChange) {
  const bytes = await readFile(path.join(await findRepoRoot(), "data/public-record-repairs", entry.revision, "record.json"));
  if (createHash("sha256").update(bytes).digest("hex") !== entry.recordSha256) throw new Error("Correction change log record hash mismatch");
  return publicEntitySummarySchema.parse(JSON.parse(bytes.toString()));
}

// Frozen public projections avoid rebuilding every historical release on an SSR request.
export async function readCorrectionChangeCache<T>(name: string): Promise<T | undefined> {
  if (process.env.UAPT_BUILD_CORRECTION_CHANGES === "1") return undefined;
  const root = path.join(await findRepoRoot(), "data/public-record-repairs");
  const journal = await readFile(path.join(root, "change-log.json"));
  const manifest = JSON.parse(await readFile(path.join(root, "change-cache/manifest.json"), "utf8"));
  if (manifest.journalSha256 !== createHash("sha256").update(journal).digest("hex")) throw new Error("Change cache is not synchronized with the policy correction journal");
  if (!Object.hasOwn(manifest.files, name) || !/^[a-z0-9.-]+\.json$/.test(name)) throw new Error("Unknown change cache projection");
  const bytes = await readFile(path.join(root, "change-cache", name));
  if (createHash("sha256").update(bytes).digest("hex") !== manifest.files[name]) throw new Error("Change cache projection hash mismatch");
  return JSON.parse(bytes.toString()) as T;
}
