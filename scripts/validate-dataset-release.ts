import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  openClawRunPurposeSchema,
  publicDatasetReleaseManifestSchema
} from "@uapt/shared";
import { getDatasetRelease } from "../apps/web/lib/dataset-release";

const requiredArtifactIds = new Set([
  "universities",
  "claims",
  "sources",
  "changes",
  "data_dictionary",
  "checksums"
]);

interface PublicReleaseInputManifest {
  includeStagedArtifactDirectories: string[];
}

void main();

async function main(): Promise<void> {
  await assertNoMaintenanceRunsInCurrentRelease();

  const release = await getDatasetRelease();
  const manifest = publicDatasetReleaseManifestSchema.parse(release.manifest);

  for (const id of requiredArtifactIds) {
    if (!manifest.artifacts.some((artifact) => artifact.id === id)) {
      throw new Error(`Missing dataset artifact: ${id}`);
    }
  }

  for (const artifact of manifest.artifacts) {
    const content = release.artifactsByPath.get(artifact.path)?.content;

    if (!content) throw new Error(`Missing generated content for ${artifact.path}`);

    const digest = sha256(content);
    if (digest !== artifact.sha256) {
      throw new Error(`Checksum mismatch for ${artifact.path}`);
    }

    const byteLength = Buffer.byteLength(content, "utf8");
    if (byteLength !== artifact.byteLength) {
      throw new Error(`Byte length mismatch for ${artifact.path}`);
    }

    if (artifact.rowCount !== undefined) {
      const rowCount = countJsonLines(content);
      if (rowCount !== artifact.rowCount) {
        throw new Error(`Row count mismatch for ${artifact.path}`);
      }
    }
  }

  const checksums = getArtifactContent(release, manifest, "checksums");
  for (const artifact of manifest.artifacts) {
    if (artifact.id === "checksums") continue;
    if (
      !checksums.includes(artifact.sha256) ||
      !checksums.includes(artifact.fileName)
    ) {
      throw new Error(`Checksums file does not include ${artifact.fileName}`);
    }
  }

  const claims = parseJsonLines(getArtifactContent(release, manifest, "claims"));
  assertUniqueCompositeRows(claims, ["entitySlug", "claimId"], "claims");
  for (const claim of claims) {
    if (typeof claim.entitySlug !== "string") {
      throw new Error("Claim row missing entitySlug");
    }
    if (typeof claim.claimText !== "string") {
      throw new Error("Claim row missing claimText");
    }
    if (!Array.isArray(claim.evidence) || claim.evidence.length < 1) {
      throw new Error(`Claim row for ${claim.entitySlug} missing evidence`);
    }
    for (const evidence of claim.evidence) {
      if (typeof evidence.sourceUrl !== "string") {
        throw new Error(`Evidence row for ${claim.entitySlug} missing sourceUrl`);
      }
      if (typeof evidence.sourceSnapshotHash !== "string") {
        throw new Error(
          `Evidence row for ${claim.entitySlug} missing sourceSnapshotHash`
        );
      }
      if (typeof evidence.evidenceSnippet !== "string") {
        throw new Error(`Evidence row for ${claim.entitySlug} missing snippet`);
      }
    }
  }

  const sources = parseJsonLines(getArtifactContent(release, manifest, "sources"));
  assertUniqueCompositeRows(
    sources,
    ["entitySlug", "sourceUrl", "snapshotHash"],
    "sources"
  );

  console.log(
    `Validated dataset release ${manifest.releaseId}: ${manifest.artifacts.length} artifacts, ${manifest.counts.universities} universities, ${manifest.counts.claims} claims, ${manifest.counts.sources} sources, ${manifest.counts.changes} changes, ${manifest.counts.evidenceRecords} evidence records.`
  );
}

async function assertNoMaintenanceRunsInCurrentRelease(): Promise<void> {
  const manifest = JSON.parse(
    await readFile("data/public-releases/current.json", "utf8")
  ) as PublicReleaseInputManifest;

  for (const directory of manifest.includeStagedArtifactDirectories) {
    const jsonFiles = await walkJsonFiles(directory);
    for (const file of jsonFiles) {
      const value = JSON.parse(await readFile(file, "utf8")) as unknown;
      if (!isRecord(value)) continue;

      const result = openClawRunPurposeSchema.safeParse(value.runPurpose);
      if (result.data === "source_health_maintenance") {
        throw new Error(
          `Public release manifest includes source-health maintenance run: ${directory}. ` +
            "Maintenance runs are source-health metadata only and must not be promoted as canonical claims."
        );
      }
    }
  }
}

function assertUniqueCompositeRows(
  rows: Record<string, unknown>[],
  keys: string[],
  artifactId: string
): void {
  const seen = new Set<string>();

  for (const row of rows) {
    const values = keys.map((key) => row[key]);
    if (values.some((value) => typeof value !== "string" || !value)) {
      throw new Error(`${artifactId} row missing one of: ${keys.join(", ")}`);
    }

    const composite = values.join("\u0000");
    if (seen.has(composite)) {
      throw new Error(
        `${artifactId} artifact contains duplicate ${keys.join("+")}: ${values.join(" | ")}`
      );
    }

    seen.add(composite);
  }
}

function getArtifactContent(
  release: Awaited<ReturnType<typeof getDatasetRelease>>,
  manifest: ReturnType<typeof publicDatasetReleaseManifestSchema.parse>,
  id: string
): string {
  const artifact = manifest.artifacts.find((item) => item.id === id);
  if (!artifact) throw new Error(`Missing artifact metadata for ${id}`);

  const content = release.artifactsByPath.get(artifact.path)?.content;
  if (!content) throw new Error(`Missing artifact content for ${id}`);

  return content;
}

function parseJsonLines(content: string): Record<string, unknown>[] {
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function countJsonLines(content: string): number {
  return content.split("\n").filter(Boolean).length;
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function walkJsonFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return walkJsonFiles(entryPath);
      if (entry.isFile() && entry.name.endsWith(".json")) return [entryPath];
      return [];
    })
  );

  return files.flat().sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
