import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { requirePolicySync } from "./lib/require-policy-sync";

/** Adapter for explicitly authorized legacy repair/content entry points. Never marks a release complete. */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(flag); return i < 0 ? undefined : args[i + 1];
  };
  const entry = get("--entry"), basisFile = get("--basis"), ledgerPath = get("--sync-ledger"), receiptPath = get("--receipt");
  const runner = get("--runner") ?? "tsx";
  if (!args.includes("--confirm") || !entry || !basisFile || !ledgerPath || !receiptPath || !["tsx", "node", "python3", "bash"].includes(runner)) {
    throw Error("Require --confirm --entry <file> --basis <frozen-file> --sync-ledger <event.json> --receipt <new-file> [--runner tsx|node|python3|bash] [-- <entry args>]. Explicit operation authorization remains required.");
  }
  const ledger = await requirePolicySync({ ledgerPath, basisFile, allowedTypes: ["policy_release"] });
  const scopeProof = ledger.scopeArtifact as { path: string; sha256: string };
  const scopeBytes = await readFile(path.resolve(path.dirname(ledgerPath), scopeProof.path));
  if (createHash("sha256").update(scopeBytes).digest("hex") !== scopeProof.sha256) throw Error("Synchronization scope changed after validation.");
  const scope = JSON.parse(scopeBytes.toString("utf8"));
  const entryHash = createHash("sha256").update(await readFile(entry)).digest("hex");
  if (scope.mutationEntry?.sha256 !== entryHash || scope.mutationEntry?.runner !== runner) throw Error("Legacy mutation entry differs from the frozen synchronization scope.");
  const pending = { eventId: ledger.eventId, basisSha256: ledger.basisSha256, entrySha256: entryHash, runner, startedAt: new Date().toISOString(), status: "pending", deploymentAccepted: false };
  await writeFile(receiptPath, `${JSON.stringify(pending, null, 2)}\n`, { flag: "wx" });
  const separator = args.indexOf("--");
  const result = spawnSync(runner, [entry, ...(separator < 0 ? [] : args.slice(separator + 1))], { stdio: "inherit" });
  await writeFile(receiptPath, `${JSON.stringify({ ...pending, finishedAt: new Date().toISOString(), exitCode: result.status, signal: result.signal, status: result.status === 0 ? "mutation_executed_completion_pending" : "failed", completionRequires: "Fresh public readback and sync-gate --phase complete; process success is not release acceptance." }, null, 2)}\n`);
  if (result.status !== 0) throw Error("Guarded mutation failed; inspect receipt and rollback artifacts.");
}
void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
