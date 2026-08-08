import {
  policySnapshotIndexSchema,
  policySnapshotResponseSchema
} from "@uapt/shared";
import {
  buildPolicySnapshotResponse,
  getLoadedPolicySnapshotIndex
} from "../apps/web/lib/policy-snapshots";

void main();

async function main(): Promise<void> {
  const index = await getLoadedPolicySnapshotIndex();
  policySnapshotIndexSchema.parse({
    ...index,
    entries: index.entries.map(({ loaded: _loaded, ...entry }) => entry)
  });

  for (const entry of index.entries) {
    const response = buildPolicySnapshotResponse(entry.loaded);
    policySnapshotResponseSchema.parse(response);
    assert(
      response.data.overallStatus === entry.overallStatus,
      `Status mismatch for ${entry.universitySlug}`
    );
  }

  console.log(
    `Policy snapshot smoke passed: ${index.entries.length} indexed snapshot(s), ${index.entries.filter((entry) => entry.overallStatus === "strong").length} strong.`
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
