import {
  disconnectPrismaClient,
  ingestCrawlRun,
  ingestSourceSnapshot,
  seedInitialCatalog
} from "../packages/db/src/index.js";
import {
  createCrawlRunIngestPayload,
  createFetchResult,
  createSourceSnapshotIngestPayload
} from "../packages/crawler-core/src/index.js";

async function main() {
  await seedInitialCatalog();

  const artifact = createFetchResult({
    target: {
      url: "https://www.harvard.edu",
      universitySlug: "harvard",
      fetchMode: "http",
      expectedThemes: ["academic_integrity"]
    },
    finalUrl: "https://www.harvard.edu",
    statusCode: 200,
    headers: {
      etag: "local-sample-etag"
    },
    rawText:
      "Local-only sample policy text. This fixture exercises staged ingestion without OpenClaw."
  });

  const crawlRun = await ingestCrawlRun(
    createCrawlRunIngestPayload(artifact, {
      sourceTitle: "Local sample Harvard source",
      robotsAllowed: true,
      metadata: { sample: true }
    })
  );

  const snapshot = await ingestSourceSnapshot(
    createSourceSnapshotIngestPayload(artifact, {
      crawlRunId: crawlRun.id,
      sourceTitle: "Local sample Harvard source",
      documentStatus: "specific_unit_policy_or_guidance",
      metadata: { sample: true }
    })
  );

  console.log({
    crawlRunId: crawlRun.id,
    sourceSnapshotId: snapshot.id,
    policySourceId: snapshot.policySourceId
  });
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrismaClient();
  });
