import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

export async function requirePolicySync(options: {
  ledgerPath?: string;
  basisFile: string;
  allowedTypes: string[];
  requirePublicReadback?: boolean;
}): Promise<Record<string, unknown>> {
  if (!options.ledgerPath) throw Error("Refusing mutation/notification without --sync-ledger; see docs/policy-evidence-integration-runbook.md.");
  const ledger = JSON.parse(await readFile(options.ledgerPath, "utf8"));
  const basis = createHash("sha256").update(await readFile(options.basisFile)).digest("hex");
  if (ledger.syncContractVersion !== "2.0.0" || !options.allowedTypes.includes(ledger.eventType) || ledger.basisSha256 !== basis) {
    throw Error("Require synchronization contract 2.0.0 bound to this exact basis artifact and operation.");
  }
  if (options.requirePublicReadback && ledger.surfaces?.public_readback?.status !== "updated") {
    throw Error("Search notification requires actual public readback before sending.");
  }
  runSyncGate(options.ledgerPath, "candidate");
  if (createHash("sha256").update(await readFile(options.basisFile)).digest("hex") !== basis) throw Error("Basis changed during synchronization validation.");
  return ledger;
}

export function runSyncGate(ledgerPath: string, phase: "candidate" | "complete"): void {
  const result = spawnSync(process.env.UAPT_INVENTORY_PYTHON ?? "python3", ["scripts/policy-inventory.py", "sync-gate", ledgerPath, "--phase", phase], { encoding: "utf8" });
  if (result.status !== 0) throw Error(`Synchronization gate rejected operation: ${result.stderr || result.error?.message || "validation failed"}`);
}
