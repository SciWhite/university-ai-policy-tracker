import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { requirePolicySync } from "./lib/require-policy-sync";

async function main(): Promise<void> {
  const candidate = value("--candidate");
  if (!candidate) {
    throw Error(
      "Usage: tsx scripts/promote-maintenance-release-candidate.ts --candidate <candidate.json> --sync-ledger <event.json> --confirm",
    );
  }
  if (!process.argv.includes("--confirm")) {
    throw Error("Refusing promotion without explicit --confirm.");
  }

  // Check frozen synchronization receipts before touching current/history manifests.
  const ledgerPath = value("--sync-ledger");
  const ledger = await requirePolicySync({ ledgerPath, basisFile: candidate, allowedTypes: ["policy_release"] });
  const candidateBytes = await readFile(candidate);
  if (createHash("sha256").update(candidateBytes).digest("hex") !== ledger.basisSha256) throw Error("Candidate changed after synchronization validation.");
  const candidateManifest = JSON.parse(candidateBytes.toString("utf8"));
  const next = {
    ...candidateManifest,
    candidateOnly: false,
    description: String(candidateManifest.description ?? "")
      .replace(/; awaiting explicit Codex promotion confirmation\.?/i, ".")
      .replace(/candidate from/i, "published maintenance release from")
  };
  if (!next.releaseId || !Array.isArray(next.includeStagedArtifactDirectories)) {
    throw Error("Invalid candidate manifest");
  }

  const currentPath = "data/public-releases/current.json";
  const current = JSON.parse(await readFile(currentPath, "utf8"));
  const history = `data/public-releases/history/${current.releaseId}.json`;

  if (!existsSync(history)) {
    await mkdir(path.dirname(history), { recursive: true });
    await copyFile(currentPath, history);
  }

  await writeFile(currentPath, `${JSON.stringify(next, null, 2)}\n`);

  for (const args of [
    ["pnpm", "validate:dataset-release"],
    ["pnpm", "validate:public-contract"],
    ["pnpm", "audit:public-data"],
    ["git", "diff", "--check"],
  ]) {
    must(args[0], args.slice(1));
  }

  console.log(
    "Promotion manifest completed locally. Commit/push and OCI deployment remain explicit operator actions.",
  );
}

function value(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function must(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) throw Error(`${command} failed`);
}

void main();
