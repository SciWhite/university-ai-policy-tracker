import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SourceHealthRow = Record<string, unknown>;

const EXCLUDED_STATUSES = new Set([
  "http_failed",
  "blocked",
  "blocked_or_inconclusive",
  "robots_blocked",
  "timeout",
  "firecrawl_failed",
  "metadata_or_chrome_delta",
  "http_or_access_noise",
]);

async function main(): Promise<void> {
  const sourceHealth = process.argv.slice(2).filter((arg) => arg !== "--")[0];
  if (!sourceHealth) {
    throw Error("Usage: tsx scripts/build-maintenance-review-queue.ts <source-health.json>");
  }

  const report = JSON.parse(await readFile(sourceHealth, "utf8"));
  const rows: SourceHealthRow[] = Array.isArray(report.rows) ? report.rows : [];
  const items = rows.filter(isEligible).map((row) => {
    const sourceUrl = String(row.sourceUrl);
    const sourceCandidateId =
      typeof row.sourceCandidateId === "string" ? row.sourceCandidateId : undefined;
    const entitySlug = String(row.entitySlug);

    return {
      itemId: `${entitySlug}-${sourceCandidateId ?? hash(sourceUrl)}`,
      entitySlug,
      sourceCandidateId,
      sourceUrl,
      sourceTitle: typeof row.sourceTitle === "string" ? row.sourceTitle : undefined,
      diffClass: "content_policy_delta",
      queueStatus: String(row.openClawQueueStatus ?? row.status),
      recommendedAction:
        typeof row.recommendedAction === "string" ? row.recommendedAction : undefined,
    };
  });
  const directory = path.dirname(sourceHealth);
  const payload = {
    schemaVersion: "uapt-maintenance-review-queue-v1",
    runId: report.runId,
    generatedAt: new Date().toISOString(),
    sourceHealth: path.basename(sourceHealth),
    items,
  };

  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "review-queue.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
  await writeFile(
    path.join(directory, "review-queue.md"),
    [
      "# Maintenance review queue",
      "",
      `Run: ${report.runId}`,
      "",
      `Eligible source-level items: ${items.length}`,
      "",
      items.length
        ? items
            .map((item) => `- \`${item.itemId}\` - ${item.entitySlug}: ${item.sourceUrl}`)
            .join("\n")
        : "No eligible policy-content candidates.",
      "",
    ].join("\n"),
  );
  console.log(`Queued ${items.length} source-level review item(s).`);
}

function isEligible(row: SourceHealthRow): boolean {
  const queueStatus = String(row.openClawQueueStatus ?? row.status);
  return (
    row.diffClass === "content_policy_delta" &&
    (queueStatus === "needs_openclaw" || queueStatus === "candidate") &&
    typeof row.entitySlug === "string" &&
    typeof row.sourceUrl === "string" &&
    /^https?:\/\//.test(row.sourceUrl) &&
    !EXCLUDED_STATUSES.has(String(row.status))
  );
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

void main();
