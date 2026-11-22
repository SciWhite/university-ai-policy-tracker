#!/usr/bin/env node
/**
 * verify-sync: check a 2.0.0/2.1.0 synchronization event against its exact basis and run the
 * sync gate. The program release controller runs it from its frozen release helper
 * (scripts/release/program-release.py --helper). That is all this file still does.
 *
 * The pre-R1 subcommands (build, inspect, local-check, lifecycle) were removed on 2026-11-21:
 * AGENTS.md forbids building on the server, and the default `pnpm build` still started that
 * build. Programs are built by .github/workflows/program-build.yml (scripts/program-build.mjs);
 * local checks are `pnpm check` and the test suites; the lifecycle controller is
 * /usr/local/libexec/uapt-release-lifecycle.py.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const [action, eventPath, basisPath, phase, ...extra] = process.argv.slice(2);
const help = `UAPT release helper
  node scripts/uapt-release.mjs verify-sync <event.json> <basis-file> <candidate|complete>
    Check contract 2.0.0/2.1.0 receipts before cutover or after actual public readback.
Builds: .github/workflows/program-build.yml (docs/program-release.md). Content: pnpm content:* (docs/content-release.md).`;

try {
  if (!action || action === "--help" || action === "help") {
    console.log(help);
  } else if (action === "verify-sync" && eventPath && basisPath && ["candidate", "complete"].includes(phase) && !extra.length) {
    const event = JSON.parse(readFileSync(resolve(root, eventPath), "utf8"));
    const basis = createHash("sha256").update(readFileSync(resolve(root, basisPath))).digest("hex");
    if (!["2.0.0", "2.1.0"].includes(event.syncContractVersion) || event.basisSha256 !== basis) throw new Error("Synchronization contract/version or exact basis mismatch");
    const result = spawnSync(process.env.UAPT_INVENTORY_PYTHON ?? "python3", ["scripts/policy-inventory.py", "sync-gate", eventPath, "--phase", phase], { cwd: root, stdio: "inherit" });
    if (result.status !== 0) throw new Error("Synchronization gate rejected this operation");
    console.log("Synchronization receipts checked; deployment and semantic approval remain separate.");
  } else {
    throw new Error(`Invalid arguments.\n${help}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
