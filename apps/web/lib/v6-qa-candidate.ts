import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import type { V6RecordPackage } from "./v6-effective-records";
import type { PublishedV6Package } from "./policy-v6-published";

function sha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

let cachedCandidateRecords: { pkg: V6RecordPackage; sha256: string; path: string; mtimeMs: number } | undefined;
let cachedCandidatePages: { pkg: PublishedV6Package; sha256: string; path: string; mtimeMs: number } | undefined;

export function resetQACandidateCache(): void {
  cachedCandidateRecords = undefined;
  cachedCandidatePages = undefined;
}

interface QAConfig {
  recordsPath: string;
  pagesPath: string;
  expectedRecordsHash: string;
  expectedPagesHash: string;
  expectedRevision: string;
}

function getValidatedQAConfig(): QAConfig | undefined {
  if (process.env.NODE_ENV !== "development") return undefined;

  const recordsPath = process.env.UAPT_LOCAL_QA_CANDIDATE_RECORDS;
  const pagesPath = process.env.UAPT_LOCAL_QA_CANDIDATE_PAGES;
  const expectedRecordsHash = process.env.UAPT_LOCAL_QA_EXPECTED_RECORDS_HASH;
  const expectedPagesHash = process.env.UAPT_LOCAL_QA_EXPECTED_PAGES_HASH;
  const expectedRevision = process.env.UAPT_LOCAL_QA_EXPECTED_REVISION;

  const anySet = Boolean(recordsPath || pagesPath || expectedRecordsHash || expectedPagesHash || expectedRevision);
  if (!anySet) return undefined;

  if (!recordsPath || !pagesPath || !expectedRecordsHash || !expectedPagesHash || !expectedRevision) {
    throw new Error(
      "UAPT_LOCAL_QA incomplete configuration: all five parameters (RECORDS, PAGES, EXPECTED_RECORDS_HASH, EXPECTED_PAGES_HASH, EXPECTED_REVISION) are required when QA candidate selection is enabled"
    );
  }

  return { recordsPath, pagesPath, expectedRecordsHash, expectedPagesHash, expectedRevision };
}

export function getLocalQACandidateRecords(): V6RecordPackage | undefined {
  const config = getValidatedQAConfig();
  if (!config) return undefined;

  const resolved = [resolve(config.recordsPath), resolve(process.cwd(), config.recordsPath), resolve(process.cwd(), "../..", config.recordsPath)].find(existsSync);
  if (!resolved) {
    throw new Error(`UAPT_LOCAL_QA_CANDIDATE_RECORDS path not found: ${config.recordsPath}`);
  }

  const stat = statSync(resolved);

  if (cachedCandidateRecords && cachedCandidateRecords.path === resolved && cachedCandidateRecords.mtimeMs === stat.mtimeMs) {
    if (cachedCandidateRecords.sha256 !== config.expectedRecordsHash) {
      throw new Error(`UAPT_LOCAL_QA_CANDIDATE_RECORDS hash mismatch: expected ${config.expectedRecordsHash}, got ${cachedCandidateRecords.sha256}`);
    }
    if (cachedCandidateRecords.pkg.revision !== config.expectedRevision) {
      throw new Error(`UAPT_LOCAL_QA_CANDIDATE_RECORDS revision mismatch: expected ${config.expectedRevision}, got ${cachedCandidateRecords.pkg.revision}`);
    }
    if (cachedCandidatePages && cachedCandidatePages.pkg.releaseId !== cachedCandidateRecords.pkg.revision) {
      throw new Error(`UAPT_LOCAL_QA pair mismatch: records revision '${cachedCandidateRecords.pkg.revision}' !== pages releaseId '${cachedCandidatePages.pkg.releaseId}'`);
    }
    return cachedCandidateRecords.pkg;
  }

  const raw = readFileSync(resolved);
  const hash = sha256(raw);

  if (hash !== config.expectedRecordsHash) {
    throw new Error(`UAPT_LOCAL_QA_CANDIDATE_RECORDS hash mismatch: expected ${config.expectedRecordsHash}, got ${hash}`);
  }

  const pkg = JSON.parse(raw.toString("utf8")) as V6RecordPackage;
  if (pkg.schemaVersion !== "uapt-v6-effective-records-v1" || pkg.publicationApproved !== true) {
    throw new Error(`UAPT_LOCAL_QA_CANDIDATE_RECORDS invalid schema or publicationApproved`);
  }

  if (pkg.revision !== config.expectedRevision) {
    throw new Error(`UAPT_LOCAL_QA_CANDIDATE_RECORDS revision mismatch: expected ${config.expectedRevision}, got ${pkg.revision}`);
  }

  if (cachedCandidatePages && cachedCandidatePages.pkg.releaseId !== pkg.revision) {
    throw new Error(`UAPT_LOCAL_QA pair mismatch: records revision '${pkg.revision}' !== pages releaseId '${cachedCandidatePages.pkg.releaseId}'`);
  }

  cachedCandidateRecords = { pkg, sha256: hash, path: resolved, mtimeMs: stat.mtimeMs };
  return pkg;
}

export function getLocalQACandidatePages(): PublishedV6Package | undefined {
  const config = getValidatedQAConfig();
  if (!config) return undefined;

  const resolved = [resolve(config.pagesPath), resolve(process.cwd(), config.pagesPath), resolve(process.cwd(), "../..", config.pagesPath)].find(existsSync);
  if (!resolved) {
    throw new Error(`UAPT_LOCAL_QA_CANDIDATE_PAGES path not found: ${config.pagesPath}`);
  }

  const stat = statSync(resolved);

  if (cachedCandidatePages && cachedCandidatePages.path === resolved && cachedCandidatePages.mtimeMs === stat.mtimeMs) {
    if (cachedCandidatePages.sha256 !== config.expectedPagesHash) {
      throw new Error(`UAPT_LOCAL_QA_CANDIDATE_PAGES hash mismatch: expected ${config.expectedPagesHash}, got ${cachedCandidatePages.sha256}`);
    }
    if (cachedCandidatePages.pkg.releaseId !== config.expectedRevision) {
      throw new Error(`UAPT_LOCAL_QA_CANDIDATE_PAGES revision mismatch: expected ${config.expectedRevision}, got ${cachedCandidatePages.pkg.releaseId}`);
    }
    if (cachedCandidateRecords && cachedCandidateRecords.pkg.revision !== cachedCandidatePages.pkg.releaseId) {
      throw new Error(`UAPT_LOCAL_QA pair mismatch: pages releaseId '${cachedCandidatePages.pkg.releaseId}' !== records revision '${cachedCandidateRecords.pkg.revision}'`);
    }
    return cachedCandidatePages.pkg;
  }

  const raw = readFileSync(resolved);
  const hash = sha256(raw);

  if (hash !== config.expectedPagesHash) {
    throw new Error(`UAPT_LOCAL_QA_CANDIDATE_PAGES hash mismatch: expected ${config.expectedPagesHash}, got ${hash}`);
  }

  const pkg = JSON.parse(raw.toString("utf8")) as PublishedV6Package;
  if (pkg.schemaVersion !== "uapt-v6-published-pages-v1" || pkg.publicationApproved !== true) {
    throw new Error(`UAPT_LOCAL_QA_CANDIDATE_PAGES invalid schema or publicationApproved`);
  }

  if (pkg.releaseId !== config.expectedRevision) {
    throw new Error(`UAPT_LOCAL_QA_CANDIDATE_PAGES revision mismatch: expected ${config.expectedRevision}, got ${pkg.releaseId}`);
  }

  if (cachedCandidateRecords && cachedCandidateRecords.pkg.revision !== pkg.releaseId) {
    throw new Error(`UAPT_LOCAL_QA pair mismatch: pages releaseId '${pkg.releaseId}' !== records revision '${cachedCandidateRecords.pkg.revision}'`);
  }

  cachedCandidatePages = { pkg, sha256: hash, path: resolved, mtimeMs: stat.mtimeMs };
  return pkg;
}
