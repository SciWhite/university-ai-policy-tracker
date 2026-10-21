import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { findRepoRoot } from "../apps/web/lib/repo-root";
import { publicHistoryBasis } from "../apps/web/lib/public-history-basis";
import { validateFrozenHistory } from "../apps/web/lib/v6-history-cache";
import { exportPublicChangeHistory } from "./export-public-change-history";
import type { ShardIndex, ShardNode, ShardManifest } from "../apps/web/lib/v6-artifact-store";

export interface CandidateBuildInputsResult {
  schemaVersion: "uapt-candidate-build-input-receipt-v1";
  status: "prepared" | "validated_only";
  stagedAt: string;
  repoRoot: string;
  sourcePackagesDir: string;
  basisSha256: string;
  historyManifestSha256: string;
  historyManifestFile: string;
  stagedFamilies: string[];
  revisions: Record<string, { revision: string; sha256: string; path: string }>;
  prebuildGuardPassed: boolean;
}

export interface PrepareCandidateBuildInputsOptions {
  packagesDir: string;
  repoRoot?: string;
  dryRun?: boolean;
}

const digest = (buf: Buffer | string) => createHash("sha256").update(buf).digest("hex");
const isValidSha256 = (val: string) => /^[a-f0-9]{64}$/.test(val);

function getRootField(root: ShardNode, field: string): unknown {
  if (!root || root.kind !== "object" || !Array.isArray(root.entries)) return undefined;
  const entry = root.entries.find(([k]) => k === field);
  if (!entry) return undefined;
  const valNode = entry[1];
  if (valNode && valNode.kind === "value") return valNode.value;
  return undefined;
}

function validateShardNode(node: ShardNode, famSrc: string, depth = 0): void {
  if (!node || depth > 12) throw new Error("Invalid V6 shard tree depth or null node");
  if (node.kind === "blob") {
    if (!isValidSha256(node.sha256) || !Number.isSafeInteger(node.bytes) || node.bytes < 1 || node.bytes > 16 * 1024 * 1024) {
      throw new Error(`Invalid V6 shard blob reference: ${JSON.stringify(node)}`);
    }
    const objPath = path.join(famSrc, "sharded", "objects", `${node.sha256}.json`);
    if (!existsSync(objPath)) {
      throw new Error(`Referenced shard blob object file missing: ${objPath}`);
    }
    const raw = readFileSync(objPath);
    if (raw.length !== node.bytes || digest(raw) !== node.sha256) {
      throw new Error(`Shard blob hash or byte size mismatch: ${objPath}`);
    }
    JSON.parse(raw.toString("utf8"));
  } else if (node.kind === "object") {
    if (!Array.isArray(node.entries) || new Set(node.entries.map(([k]) => k)).size !== node.entries.length) {
      throw new Error("Duplicate or malformed V6 shard object fields");
    }
    for (const [key, value] of node.entries) {
      if (["__proto__", "constructor", "prototype"].includes(key)) {
        throw new Error(`Forbidden field name in shard object: ${key}`);
      }
      validateShardNode(value, famSrc, depth + 1);
    }
  } else if (node.kind === "array") {
    if (!Array.isArray(node.items) || (node.keys && (node.keys.length !== node.items.length || new Set(node.keys).size !== node.keys.length))) {
      throw new Error("Invalid V6 shard collection items or keys");
    }
    for (const item of node.items) {
      validateShardNode(item, famSrc, depth + 1);
    }
  } else if (node.kind !== "value") {
    throw new Error(`Unknown V6 shard node kind: ${(node as { kind: string }).kind}`);
  }
}

export async function verifyPublicHistoryOnDisk(
  repoRoot: string,
  expectedBasis?: string
): Promise<{ manifest: any; basis: string }> {
  const historyRoot = path.join(repoRoot, "data/public-change-history");
  const currentFile = path.join(historyRoot, "current.json");
  if (!existsSync(currentFile)) {
    throw new Error("Missing public-change-history current.json on disk");
  }
  const current = JSON.parse(readFileSync(currentFile, "utf8"));
  if (!current.path || !isValidSha256(current.sha256)) {
    throw new Error("Malformed public-change-history current.json");
  }
  const manifestFile = path.join(historyRoot, current.path);
  if (!existsSync(manifestFile)) {
    throw new Error(`Missing manifest file: ${manifestFile}`);
  }
  const manifestRaw = readFileSync(manifestFile);
  if (digest(manifestRaw) !== current.sha256) {
    throw new Error("Manifest sha256 mismatch with current.json pointer");
  }
  const manifest = JSON.parse(manifestRaw.toString("utf8"));
  if (manifest.schemaVersion !== "uapt-public-change-history-v1") {
    throw new Error("Invalid manifest schemaVersion");
  }
  const basis = await publicHistoryBasis(repoRoot);
  if (manifest.basisSha256 !== basis || (expectedBasis && basis !== expectedBasis)) {
    throw new Error("Public change history is out of date; regenerate with scripts/export-public-change-history.ts");
  }
  if (!manifest.entries || typeof manifest.entries !== "object") {
    throw new Error("Missing entries in public change history manifest");
  }
  for (const [slug, entry] of Object.entries(manifest.entries as Record<string, { file: string; sha256: string; bytes: number }>)) {
    const fPath = path.join(historyRoot, entry.file);
    if (!existsSync(fPath)) throw new Error(`Missing entry file for ${slug}: ${entry.file}`);
    const raw = readFileSync(fPath);
    if (raw.length !== entry.bytes || digest(raw) !== entry.sha256) {
      throw new Error(`Entry file hash/byte mismatch: ${entry.file}`);
    }
  }
  if (manifest.releases && typeof manifest.releases === "object") {
    for (const [relId, entry] of Object.entries(manifest.releases as Record<string, { file: string; sha256: string; bytes: number }>)) {
      const fPath = path.join(historyRoot, entry.file);
      if (!existsSync(fPath)) throw new Error(`Missing release file for ${relId}: ${entry.file}`);
      const raw = readFileSync(fPath);
      if (raw.length !== entry.bytes || digest(raw) !== entry.sha256) {
        throw new Error(`Release file hash/byte mismatch: ${entry.file}`);
      }
    }
  }
  return { manifest, basis };
}

export async function prepareCandidateBuildInputs(
  options: PrepareCandidateBuildInputsOptions
): Promise<CandidateBuildInputsResult> {
  const repoRoot = options.repoRoot ? path.resolve(options.repoRoot) : await findRepoRoot();
  const srcDir = path.resolve(options.packagesDir);

  const families = ["public-v6-pages", "public-v6-records", "public-v6-history"] as const;
  const revisions: Record<string, { revision: string; sha256: string; path: string }> = {};
  const familySourceData: Record<string, {
    revId: string;
    currentData: { path: string; sha256: string; [k: string]: unknown };
    index: ShardIndex;
    manifest: ShardManifest;
  }> = {};

  // =========================================================================
  // STEP 1: Full Cryptographic Pre-Validation Before Any Writes
  // =========================================================================
  for (const family of families) {
    const famSrc = path.join(srcDir, family);
    if (!existsSync(famSrc)) {
      throw new Error(`Missing expected candidate package family directory: ${famSrc}`);
    }

    // 1.1 current.json validation
    const currFile = path.join(famSrc, "current.json");
    if (!existsSync(currFile)) {
      throw new Error(`Missing current.json in ${famSrc}`);
    }
    const currRaw = readFileSync(currFile, "utf8");
    const currData = JSON.parse(currRaw);
    const revId = (currData.releaseId || currData.revision || currData.basisRevision) as string | undefined;
    if (!revId || typeof revId !== "string") {
      throw new Error(`Missing valid revision identifier in ${currFile}`);
    }
    if (!currData.sha256 || !isValidSha256(currData.sha256)) {
      throw new Error(`Invalid sha256 in ${currFile}: ${currData.sha256}`);
    }
    if (!currData.path || typeof currData.path !== "string" || path.isAbsolute(currData.path) || currData.path.includes("..")) {
      throw new Error(`Missing or unsafe path in ${currFile}`);
    }
    revisions[family] = {
      revision: revId,
      sha256: currData.sha256,
      path: currData.path
    };

    // 1.2 sharded/index.json validation
    const srcIndexFile = path.join(famSrc, "sharded", "index.json");
    if (!existsSync(srcIndexFile)) {
      throw new Error(`Missing sharded/index.json in ${famSrc}`);
    }
    const srcIndex = JSON.parse(readFileSync(srcIndexFile, "utf8")) as ShardIndex;
    if (srcIndex.schemaVersion !== "uapt-v6-shard-index-v1" || srcIndex.family !== family) {
      throw new Error(`Invalid index schema or family mismatch in ${srcIndexFile}`);
    }
    const indexEntry = srcIndex.revisions[revId];
    if (!indexEntry) {
      throw new Error(`Index in ${famSrc} does not contain revision ${revId}`);
    }
    if (indexEntry.sourceSha256 !== currData.sha256) {
      throw new Error(`Index entry sourceSha256 in ${famSrc} does not match current.json for ${revId}`);
    }
    if (!isValidSha256(indexEntry.sha256)) {
      throw new Error(`Index entry sha256 in ${famSrc} is invalid for ${revId}`);
    }
    if (!/^sharded\/revisions\/[a-z0-9-]+\.json$/.test(indexEntry.path) || indexEntry.path.includes("..")) {
      throw new Error(`Index entry path in ${famSrc} is invalid for ${revId}: ${indexEntry.path}`);
    }

    // 1.3 Revision manifest file validation
    const revFile = path.join(famSrc, indexEntry.path);
    if (!existsSync(revFile)) {
      throw new Error(`Missing revision file pointed by index: ${revFile}`);
    }
    const revRaw = readFileSync(revFile);
    if (digest(revRaw) !== indexEntry.sha256) {
      throw new Error(`Revision manifest hash mismatch for ${revFile}: expected ${indexEntry.sha256}, got ${digest(revRaw)}`);
    }
    const manifest = JSON.parse(revRaw.toString("utf8")) as ShardManifest;
    if (manifest.schemaVersion !== "uapt-v6-shard-manifest-v1" || manifest.family !== family || manifest.revision !== revId || manifest.sourceSha256 !== currData.sha256) {
      throw new Error(`Manifest identity or schema mismatch in ${revFile}`);
    }
    if (!Array.isArray(manifest.scope) || new Set(manifest.scope).size !== manifest.scope.length || manifest.scope.length === 0) {
      throw new Error(`Invalid manifest scope in ${revFile}`);
    }

    // 1.4 Shard tree deep validation
    validateShardNode(manifest.root, famSrc);

    // 1.5 Individual object hash integrity
    const srcObjectsDir = path.join(famSrc, "sharded", "objects");
    if (existsSync(srcObjectsDir)) {
      for (const objFile of readdirSync(srcObjectsDir)) {
        if (!objFile.endsWith(".json")) continue;
        const expectedHash = objFile.slice(0, -5);
        if (!isValidSha256(expectedHash)) {
          throw new Error(`Invalid object filename in ${srcObjectsDir}: ${objFile}`);
        }
        const objRaw = readFileSync(path.join(srcObjectsDir, objFile));
        if (digest(objRaw) !== expectedHash) {
          throw new Error(`Object hash mismatch in ${objFile}: expected ${expectedHash}, got ${digest(objRaw)}`);
        }
        JSON.parse(objRaw.toString("utf8"));
      }
    }

    // 1.6 Destination compatibility & immutability checks
    const famDst = path.join(repoRoot, "data", family);
    const dstIndexFile = path.join(famDst, "sharded", "index.json");
    if (existsSync(dstIndexFile)) {
      const dstIndex = JSON.parse(readFileSync(dstIndexFile, "utf8")) as ShardIndex;
      if (dstIndex.schemaVersion !== "uapt-v6-shard-index-v1") {
        throw new Error(`Existing destination shard index invalid schema in ${dstIndexFile}`);
      }
      // Fail closed if any historical revision mapping would be overwritten with differing values
      for (const [histRev, histEntry] of Object.entries(dstIndex.revisions)) {
        if (srcIndex.revisions[histRev]) {
          const incoming = srcIndex.revisions[histRev];
          if (incoming.path !== histEntry.path || incoming.sha256 !== histEntry.sha256 || incoming.sourceSha256 !== histEntry.sourceSha256) {
            throw new Error(`Historical revision mapping overwrite rejected for ${histRev} in ${family}`);
          }
        }
      }
    }

    const dstObjectsDir = path.join(famDst, "sharded", "objects");
    if (existsSync(srcObjectsDir) && existsSync(dstObjectsDir)) {
      for (const objFile of readdirSync(srcObjectsDir)) {
        if (!objFile.endsWith(".json")) continue;
        const dstObjPath = path.join(dstObjectsDir, objFile);
        if (existsSync(dstObjPath)) {
          const expectedHash = objFile.slice(0, -5);
          const existingRaw = readFileSync(dstObjPath);
          if (digest(existingRaw) !== expectedHash) {
            throw new Error(`Destination object hash collision/corruption for ${dstObjPath}`);
          }
        }
      }
    }

    const dstRevsDir = path.join(famDst, "sharded", "revisions");
    const srcRevsDir = path.join(famSrc, "sharded", "revisions");
    if (existsSync(srcRevsDir) && existsSync(dstRevsDir)) {
      for (const revFileName of readdirSync(srcRevsDir)) {
        if (!revFileName.endsWith(".json")) continue;
        const dstRevPath = path.join(dstRevsDir, revFileName);
        if (existsSync(dstRevPath)) {
          const srcRevPath = path.join(srcRevsDir, revFileName);
          const srcBytes = readFileSync(srcRevPath);
          const dstBytes = readFileSync(dstRevPath);
          if (digest(srcBytes) !== digest(dstBytes)) {
            throw new Error(`Destination revision file conflict for ${dstRevPath}`);
          }
        }
      }
    }

    familySourceData[family] = {
      revId,
      currentData: currData,
      index: srcIndex,
      manifest
    };
  }

  // =========================================================================
  // STEP 1.7: Cross-Family Identity & Revision Equality Verification
  // =========================================================================
  const targetRev = revisions["public-v6-pages"].revision;
  if (
    revisions["public-v6-records"].revision !== targetRev ||
    revisions["public-v6-history"].revision !== targetRev
  ) {
    throw new Error(
      `Candidate family revisions mismatch: pages=${revisions["public-v6-pages"].revision}, records=${revisions["public-v6-records"].revision}, history=${revisions["public-v6-history"].revision}`
    );
  }

  const pagesMan = familySourceData["public-v6-pages"].manifest;
  const recordsMan = familySourceData["public-v6-records"].manifest;
  const historyMan = familySourceData["public-v6-history"].manifest;

  // Root payload identities
  const pagesPayloadRev = getRootField(pagesMan.root, "releaseId");
  const pagesPayloadSchema = getRootField(pagesMan.root, "schemaVersion");
  const pagesPayloadApproved = getRootField(pagesMan.root, "publicationApproved");
  if (pagesPayloadRev !== targetRev || pagesPayloadSchema !== "uapt-v6-published-pages-v1" || pagesPayloadApproved !== true) {
    throw new Error(`Root payload identity mismatch in public-v6-pages manifest for ${targetRev}`);
  }

  const recordsPayloadRev = getRootField(recordsMan.root, "revision");
  const recordsPayloadSchema = getRootField(recordsMan.root, "schemaVersion");
  const recordsPayloadApproved = getRootField(recordsMan.root, "publicationApproved");
  if (recordsPayloadRev !== targetRev || recordsPayloadSchema !== "uapt-v6-effective-records-v1" || recordsPayloadApproved !== true) {
    throw new Error(`Root payload identity mismatch in public-v6-records manifest for ${targetRev}`);
  }

  const historyPayloadRev = getRootField(historyMan.root, "basisRevision");
  const historyPayloadSchema = getRootField(historyMan.root, "schemaVersion");
  if (historyPayloadRev !== targetRev || historyPayloadSchema !== "uapt-bounded-public-history-v1") {
    throw new Error(`Root payload identity mismatch in public-v6-history manifest for ${targetRev}`);
  }

  // Cross-family scope consistency
  const pagesScopeStr = JSON.stringify(pagesMan.scope);
  const recordsScopeStr = JSON.stringify(recordsMan.scope);
  const historyScopeStr = JSON.stringify(historyMan.scope);
  if (pagesScopeStr !== recordsScopeStr || recordsScopeStr !== historyScopeStr) {
    throw new Error("Candidate family scopes mismatch across pages, records, and history");
  }

  // Pointer slugs consistency
  const pagesCurrSlugs = familySourceData["public-v6-pages"].currentData.slugs;
  if (!Array.isArray(pagesCurrSlugs) || JSON.stringify(pagesCurrSlugs) !== pagesScopeStr) {
    throw new Error("public-v6-pages current.json slugs mismatch with manifest scope");
  }
  const recordsCurrSlugs = familySourceData["public-v6-records"].currentData.slugs;
  if (!Array.isArray(recordsCurrSlugs) || JSON.stringify(recordsCurrSlugs) !== recordsScopeStr) {
    throw new Error("public-v6-records current.json slugs mismatch with manifest scope");
  }

  // =========================================================================
  // STEP 1.8: Preflight Frozen History Shape & Integrity Validation
  // =========================================================================
  const historyRecordsNode = historyMan.root.entries.find((e) => e[0] === "records")?.[1];
  if (!historyRecordsNode || historyRecordsNode.kind !== "object") {
    throw new Error("Missing or invalid records entry in public-v6-history manifest root");
  }
  const historyRecordsMap = new Map<string, ShardNode>(historyRecordsNode.entries);
  const historyObjectsDir = path.join(srcDir, "public-v6-history", "sharded", "objects");

  for (const slug of historyMan.scope) {
    const shard = historyRecordsMap.get(slug);
    if (!shard || shard.kind !== "blob") {
      throw new Error(`Missing or non-blob shard descriptor for ${slug} in public-v6-history manifest`);
    }
    const objFile = path.join(historyObjectsDir, `${shard.sha256}.json`);
    if (!existsSync(objFile)) {
      throw new Error(`Missing shard object file for ${slug} (${shard.sha256}) in public-v6-history`);
    }
    const rawObj = readFileSync(objFile);
    if (digest(rawObj) !== shard.sha256) {
      throw new Error(`Shard object hash mismatch for ${slug}: expected ${shard.sha256}, got ${digest(rawObj)}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawObj.toString("utf8"));
    } catch (e) {
      throw new Error(`Failed to parse shard JSON for ${slug} (${shard.sha256}): ${e}`);
    }
    validateFrozenHistory(slug, parsed);
  }

  // =========================================================================
  // STEP 2: Dry Run Handling (Failsafe: No Mutating Writes, Typed Result)
  // =========================================================================
  if (options.dryRun) {
    return {
      schemaVersion: "uapt-candidate-build-input-receipt-v1",
      status: "validated_only",
      stagedAt: new Date().toISOString(),
      repoRoot,
      sourcePackagesDir: srcDir,
      basisSha256: "dry-run",
      historyManifestSha256: "dry-run",
      historyManifestFile: "dry-run",
      stagedFamilies: [...families],
      revisions,
      prebuildGuardPassed: false
    };
  }

  // =========================================================================
  // STEP 3: Stage Package Artifacts Atomically Into repoRoot/data
  // =========================================================================
  for (const family of families) {
    const famSrc = path.join(srcDir, family);
    const famDst = path.join(repoRoot, "data", family);
    const { revId, index: srcIndex } = familySourceData[family];

    // 3.1 Stage sharded objects
    const srcObjectsDir = path.join(famSrc, "sharded", "objects");
    const dstObjectsDir = path.join(famDst, "sharded", "objects");
    if (existsSync(srcObjectsDir)) {
      mkdirSync(dstObjectsDir, { recursive: true });
      for (const obj of readdirSync(srcObjectsDir)) {
        if (!obj.endsWith(".json")) continue;
        const srcObj = path.join(srcObjectsDir, obj);
        const dstObj = path.join(dstObjectsDir, obj);
        if (!existsSync(dstObj)) {
          copyFileSync(srcObj, dstObj);
        }
      }
    }

    // 3.2 Stage sharded revisions
    const srcRevsDir = path.join(famSrc, "sharded", "revisions");
    const dstRevsDir = path.join(famDst, "sharded", "revisions");
    if (existsSync(srcRevsDir)) {
      mkdirSync(dstRevsDir, { recursive: true });
      for (const rev of readdirSync(srcRevsDir)) {
        if (!rev.endsWith(".json")) continue;
        const srcRev = path.join(srcRevsDir, rev);
        const dstRev = path.join(dstRevsDir, rev);
        if (!existsSync(dstRev)) {
          copyFileSync(srcRev, dstRev);
        }
      }
    }

    // 3.3 Merge and safely persist index.json preserving historical revisions
    const dstIndexFile = path.join(famDst, "sharded", "index.json");
    let dstIndex: ShardIndex;
    if (existsSync(dstIndexFile)) {
      dstIndex = JSON.parse(readFileSync(dstIndexFile, "utf8")) as ShardIndex;
    } else {
      dstIndex = {
        schemaVersion: "uapt-v6-shard-index-v1",
        family,
        revisions: {}
      };
    }
    dstIndex.revisions[revId] = srcIndex.revisions[revId];
    const nextIndexFile = `${dstIndexFile}.next`;
    writeFileSync(nextIndexFile, JSON.stringify(dstIndex, null, 2) + "\n");
    renameSync(nextIndexFile, dstIndexFile);

    // 3.4 Update current.json
    const srcCurrentFile = path.join(famSrc, "current.json");
    const dstCurrentFile = path.join(famDst, "current.json");
    const nextCurrentFile = `${dstCurrentFile}.next`;
    copyFileSync(srcCurrentFile, nextCurrentFile);
    renameSync(nextCurrentFile, dstCurrentFile);
  }

  // =========================================================================
  // STEP 4: Export Public Change History in Isolated Execution
  // =========================================================================
  const historyResult = await exportPublicChangeHistory({ repoRoot });

  // =========================================================================
  // STEP 5: Verify the Public History Manifest Guard on Disk
  // =========================================================================
  const verifyResult = await verifyPublicHistoryOnDisk(repoRoot, historyResult.basisSha256);

  return {
    schemaVersion: "uapt-candidate-build-input-receipt-v1",
    status: "prepared",
    stagedAt: new Date().toISOString(),
    repoRoot,
    sourcePackagesDir: srcDir,
    basisSha256: verifyResult.basis,
    historyManifestSha256: historyResult.sha256,
    historyManifestFile: historyResult.manifestFile,
    stagedFamilies: [...families],
    revisions,
    prebuildGuardPassed: true
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  let packagesDir = "";
  let dryRun = false;
  let repoRoot: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--packages" && args[i + 1]) {
      packagesDir = args[++i];
    } else if (args[i] === "--repo-root" && args[i + 1]) {
      repoRoot = args[++i];
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  if (!packagesDir) {
    console.error("Usage: tsx scripts/prepare-candidate-build-inputs.ts --packages <dir> [--repo-root <dir>] [--dry-run]");
    process.exit(1);
  }

  prepareCandidateBuildInputs({ packagesDir, repoRoot, dryRun })
    .then((res) => {
      console.log(JSON.stringify(res, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
