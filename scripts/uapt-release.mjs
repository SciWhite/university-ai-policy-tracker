#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const [action, expectedSha, ...extra] = process.argv.slice(2);
const help = `UAPT release helpers (no build or deployment commands)
  node scripts/uapt-release.mjs local-check
    Run git diff --check and pnpm check; add change-specific tests separately.
  node scripts/uapt-release.mjs inspect <full-40-character-sha>
    Read-only OCI build identity check. Run from the frozen release checkout.
  node scripts/uapt-release.mjs verify-sync <event.json> <basis-file> <candidate|complete>
    Check contract 2.0.0/2.1.0 receipts before cutover or after actual public readback.
  node scripts/uapt-release.mjs lifecycle <audit|prebuild|gate|cutover|complete|recover> [plan.json] [--completion-ledger event.json]
    Host lifecycle admission, bounded slots, recovery and mandatory retirement.
  node scripts/uapt-release.mjs --help
Choose docs/release-routing-policy.md first: small updates use docs/oci-small-release.md; full builds are reserved for large/global releases.`;

function git(...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}
function hash(relativePath) {
  return createHash("sha256").update(readFileSync(resolve(root, relativePath))).digest("hex");
}
function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));
}

try {
  if (!action || action === "--help" || action === "help") {
    console.log(help);
  } else if (action === "lifecycle") {
    const installed = "/usr/local/libexec/uapt-release-lifecycle.py";
    if (existsSync("/srv/uapt/operations/release-lifecycle/policy.json") && !existsSync(installed)) throw new Error("Missing installed lifecycle controller; do not fall back to a historical publisher");
    const controller = existsSync(installed) ? installed : resolve(root, "scripts/uapt-release-lifecycle.py");
    const result = spawnSync(process.env.UAPT_INVENTORY_PYTHON ?? "python3", [controller, ...[expectedSha, ...extra].filter(Boolean)], {cwd: root, stdio: "inherit"});
    if (result.status !== 0) throw new Error("Lifecycle operation rejected or failed");
  } else if (action === "local-check" && !expectedSha && !extra.length) {
    for (const [command, args] of [["git", ["diff", "--check"]], ["git", ["diff", "--cached", "--check"]], ["pnpm", ["check"]]]) {
      const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`${command} preflight failed (${result.status ?? result.signal})`);
    }
    console.log("Local non-build preflight passed. Targeted tests/browser checks and OCI artifact acceptance are still required.");
  } else if (action === "verify-sync" && expectedSha && extra.length === 2 && ["candidate", "complete"].includes(extra[1])) {
    const event = readJson(expectedSha);
    if (!["2.0.0", "2.1.0"].includes(event.syncContractVersion) || event.basisSha256 !== hash(extra[0])) throw new Error("Synchronization contract/version or exact basis mismatch");
    const result = spawnSync(process.env.UAPT_INVENTORY_PYTHON ?? "python3", ["scripts/policy-inventory.py", "sync-gate", expectedSha, "--phase", extra[1]], { cwd: root, stdio: "inherit" });
    if (result.status !== 0) throw new Error("Synchronization gate rejected this operation");
    console.log("Synchronization receipts checked; deployment and semantic approval remain separate.");
  } else if (action === "inspect" && /^[0-9a-f]{40}$/.test(expectedSha ?? "") && !extra.length) {
    const sha = git("rev-parse", "HEAD");
    if (sha !== expectedSha) throw new Error("Checkout SHA differs from frozen release SHA");
    if (git("status", "--porcelain", "--untracked-files=normal")) {
      throw new Error("Release checkout has modified or untracked non-ignored source files");
    }
    const buildId = readFileSync(resolve(root, "apps/web/.next/BUILD_ID"), "utf8").trim();
    if (!buildId) throw new Error("Missing Next BUILD_ID");
    const manifestPath = "data/public-releases/current.json";
    const runtimeManifestPath = `apps/web/.runtime-data/${manifestPath}`;
    const manifestHash = hash(manifestPath);
    if (manifestHash !== hash(runtimeManifestPath)) throw new Error("Repository/runtime data manifest mismatch");
    const pkg = readJson("package.json");
    console.log(JSON.stringify({
      schemaVersion: 1,
      releaseRoot: root,
      sha,
      buildId,
      dataReleaseId: readJson(runtimeManifestPath).releaseId,
      manifestSha256: manifestHash,
      lockfileSha256: hash("pnpm-lock.yaml"),
      nextConfigSha256: hash("apps/web/next.config.ts"),
      nodeVersion: process.version,
      packageManager: pkg.packageManager,
      acceptance: "not_asserted_by_identity_check"
    }, null, 2));
  } else {
    throw new Error(`Invalid arguments.\n${help}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
