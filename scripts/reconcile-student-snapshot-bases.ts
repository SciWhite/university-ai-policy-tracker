import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { policySnapshotSchema, type PublicEntitySummary } from "../packages/shared/src";
import { validatePolicySnapshotAgainstPublicData } from "../apps/web/lib/policy-snapshots";

/** Compare frozen versions with frozen published corrections; never repin or approve. */
async function main(): Promise<void> {
  const packagesRoot = argument("--packages-root");
  const releaseId = argument("--release-id");
  const output = argument("--output");
  if (!packagesRoot || !releaseId || !output) throw Error("Require --packages-root, --release-id and --output");
  const slugs = ["massachusetts-institute-of-technology", "imperial-college-london"];
  const results = [];
  for (const slug of slugs) {
    const folder = path.join(packagesRoot, slug);
    const manifestBytes = await readFile(path.join(folder, "manifest.json"));
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    for (const [file, hash] of Object.entries(manifest.files)) {
      const resolved = path.resolve(folder, file);
      if (!resolved.startsWith(`${path.resolve(folder)}${path.sep}`)) throw Error("Package path escapes");
      if (createHash("sha256").update(await readFile(resolved)).digest("hex") !== hash) throw Error("Package byte mismatch");
    }
    const records = JSON.parse(await readFile(path.join(folder, "records.json"), "utf8"));
    const publicRecords: PublicEntitySummary[] = JSON.parse(await readFile(path.join(folder, "public-records.json"), "utf8"));
    const summary = publicRecords.find((record) => record.entity.slug === slug);
    if (!summary) throw Error("Missing frozen public basis");
    for (const record of records.filter((item: { layer: string }) => item.layer === "student_snapshot")) {
      const snapshot = policySnapshotSchema.parse(record.record);
      const validation = validatePolicySnapshotAgainstPublicData(snapshot, summary, releaseId);
      results.push({
        slug, recordKey: record.recordKey,
        packageManifestSha256: createHash("sha256").update(manifestBytes).digest("hex"),
        frozenReleaseId: releaseId, storedReleaseId: snapshot.releaseId,
        storedBasisFingerprint: snapshot.basisFingerprint,
        storedReviewState: snapshot.review.reviewState,
        validation, approvalChanged: false, deploymentPerformed: false,
      });
    }
  }
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify({ schemaVersion: "uapt-private-snapshot-reconciliation-v1", generatedAt: new Date().toISOString(), results }, null, 2)}\n`, { flag: "wx" });
  console.log(`Compared ${results.length} frozen student-summary versions; no repinning or approval.`);
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

void main();
