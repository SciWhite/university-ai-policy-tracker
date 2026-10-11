import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { requirePolicySync, runSyncGate } from "./lib/require-policy-sync";
import {
  DEFAULT_INDEXNOW_KEY,
  DEFAULT_INDEXNOW_HOST,
  DEFAULT_INDEXNOW_BASE_URL,
  DEFAULT_INDEXNOW_ENDPOINT,
  getLatestReleaseIndexNowUrls,
  intersectIndexNowUrlsWithPublishedSitemap,
  getAllIndexNowUrls,
  submitToIndexNow,
  normalizeIndexNowUrl
} from "../apps/web/lib/indexnow";

function printUsage(): void {
  console.log(`
IndexNow URL Submission Tool for University AI Policy Tracker

Usage:
  tsx --tsconfig apps/web/tsconfig.json scripts/submit-indexnow.ts [options]

Modes (choose at least one):
  --latest                Submit URLs changed in the latest published release (recommended for releases)
  --all                   Submit all sitemap URLs (full site indexing)
  --urls <url1,url2,...>  Submit specific comma-separated URLs or paths

Options:
  --dry-run               Simulate submission without making real network requests
  --sync-ledger <file>     Required for live submission; fresh public readback and exact URL scope
  --key <key>             Override IndexNow API key (default: ${DEFAULT_INDEXNOW_KEY})
  --host <host>           Override host (default: ${DEFAULT_INDEXNOW_HOST})
  --base-url <url>        Override base URL (default: https://<host>)
  --endpoint <url>        Override IndexNow endpoint (default: ${DEFAULT_INDEXNOW_ENDPOINT})
  --help                  Show this help message

Examples:
  # Dry-run test of latest release changes:
  pnpm indexnow:dry-run

  # Submit latest release changes to Bing / IndexNow:
  pnpm indexnow:latest --sync-ledger <event.json>

  # Submit full site URLs:
  pnpm indexnow:all --sync-ledger <event.json>

  # Submit specific pages:
  tsx --tsconfig apps/web/tsconfig.json scripts/submit-indexnow.ts --urls /universities/oxford,/changes
`);
}

function getArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) return undefined;
  return process.argv[index + 1];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const dryRun = args.includes("--dry-run");
  const isLatest = args.includes("--latest");
  const isAll = args.includes("--all");
  const rawUrlsArg = getArgValue("--urls");
  const ledgerPath = getArgValue("--sync-ledger");
  const syncEvent = dryRun ? undefined : await requirePolicySync({ ledgerPath, basisFile: process.env.UAPT_PUBLIC_RELEASE_MANIFEST ?? "data/public-releases/current.json", allowedTypes: ["policy_release", "index_notification"], requirePublicReadback: true });

  if (!isLatest && !isAll && !rawUrlsArg) {
    console.error("Error: Please specify submission mode: --latest, --all, or --urls <url1,url2,...>\n");
    printUsage();
    process.exit(1);
  }

  const key = getArgValue("--key") || process.env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
  const host = getArgValue("--host") || process.env.INDEXNOW_HOST || DEFAULT_INDEXNOW_HOST;
  const baseUrl = getArgValue("--base-url") || `https://${host}`;
  const endpoint = getArgValue("--endpoint") || process.env.INDEXNOW_ENDPOINT || DEFAULT_INDEXNOW_ENDPOINT;

  console.log("=== IndexNow Submission ===");
  console.log(`Host:     ${host}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Key:      ${key}`);
  console.log(`Mode:     ${dryRun ? "[DRY RUN - No network requests]" : "[LIVE SUBMISSION]"}`);

  // Verify key file existence locally
  const keyFilePath = path.resolve(process.cwd(), "apps/web/public", `${key}.txt`);
  if (fs.existsSync(keyFilePath)) {
    console.log(`Key file: ${keyFilePath} (found locally)`);
  } else {
    console.warn(`\nWarning: Key file not found at ${keyFilePath}`);
    console.warn(`Make sure https://${host}/${key}.txt is publicly reachable on production.\n`);
  }

  let urls: string[] = [];

  if (isLatest) {
    console.log("\nExtracting changed URLs from latest release...");
    const latestUrls = await getLatestReleaseIndexNowUrls(baseUrl);
    console.log(`Found ${latestUrls.length} URLs in latest release diff.`);
    urls.push(...latestUrls);
  }

  if (isAll) {
    console.log("\nExtracting all sitemap URLs...");
    const allUrls = await getAllIndexNowUrls(baseUrl);
    console.log(`Found ${allUrls.length} total URLs in sitemaps.`);
    urls.push(...allUrls);
  }

  if (rawUrlsArg) {
    const customUrls = rawUrlsArg
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean)
      .map((u) => normalizeIndexNowUrl(u, baseUrl));
    console.log(`Adding ${customUrls.length} custom URLs from arguments.`);
    urls.push(...customUrls);
  }

  // Deduplicate and normalize
  const candidateUrls = Array.from(new Set(urls.map((u) => normalizeIndexNowUrl(u, baseUrl))));
  // Reject out-of-scope requests before any public sitemap network request.
  if (syncEvent && ledgerPath) {
    const proof = syncEvent.scopeArtifact as { path: string; sha256: string };
    const bytes = fs.readFileSync(path.resolve(path.dirname(ledgerPath), proof.path));
    if (createHash("sha256").update(bytes).digest("hex") !== proof.sha256) throw Error("Notification scope changed after validation.");
    const scope = JSON.parse(bytes.toString("utf8")) as { changedUrls?: string[] };
    if (!Array.isArray(scope.changedUrls) || candidateUrls.some((url) => !scope.changedUrls!.includes(url))) throw Error("Notification URLs exceed the frozen synchronization scope.");
  }
  const finalUrls = dryRun ? candidateUrls : candidateUrls.length > 0
    ? await intersectIndexNowUrlsWithPublishedSitemap(candidateUrls, baseUrl) : [];
  if (dryRun) console.log(`Offline preview: ${candidateUrls.length} local URLs; live submission also filters against the published sitemap.`);
  else console.log(`Published sitemap filter: ${candidateUrls.length} candidate URLs -> ${finalUrls.length} published URLs.`);
  if (!dryRun && finalUrls.length === 0) throw Error("No eligible URLs; no notification sent.");
  let completionPath: string | undefined;
  let notificationPath: string | undefined;
  let notificationScope: { universities: Array<{ slug: string }>; changedUrls: string[] } | undefined;
  if (syncEvent && ledgerPath) {
    const scopeProof = syncEvent.scopeArtifact as { path: string; sha256: string };
    const scopeBytes = fs.readFileSync(path.resolve(path.dirname(ledgerPath), scopeProof.path));
    if (createHash("sha256").update(scopeBytes).digest("hex") !== scopeProof.sha256) throw Error("Notification scope changed after validation.");
    notificationScope = JSON.parse(scopeBytes.toString("utf8"));
    if (!notificationScope || !Array.isArray(notificationScope.changedUrls) || finalUrls.some((url) => !notificationScope!.changedUrls.includes(url))) {
      throw Error("Notification URLs exceed the frozen synchronization scope.");
    }
    const stamp = Date.now().toString();
    notificationPath = path.resolve(path.dirname(ledgerPath), `notification-${stamp}.json`);
    completionPath = path.resolve(path.dirname(ledgerPath), `completion-indexnow-${stamp}.json`);
    fs.writeFileSync(notificationPath, JSON.stringify({ status: "pending", urls: finalUrls }), { flag: "wx" });
  }

  console.log(`\nTotal unique URLs ${dryRun ? "in preview" : "to submit"}: ${finalUrls.length}`);
  console.log("Sample URLs (up to 10):");
  finalUrls.slice(0, 10).forEach((u, i) => console.log(`  ${i + 1}. ${u}`));
  if (finalUrls.length > 10) {
    console.log(`  ... and ${finalUrls.length - 10} more`);
  }

  console.log(dryRun ? "\nSimulating submission locally..." : "\nSubmitting to IndexNow...");
  let results: Awaited<ReturnType<typeof submitToIndexNow>>;
  try { results = await submitToIndexNow({
    urls: finalUrls,
    key,
    host,
    dryRun,
    endpoint
  }); } catch (error) {
    if (notificationPath) fs.writeFileSync(notificationPath, JSON.stringify({ status: "failed", urls: finalUrls, error: String(error), indexingConfirmed: false }));
    throw error;
  }

  console.log("\n=== Submission Results ===");
  let allOk = true;

  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    const prefix = res.ok ? "✓" : "✗";
    console.log(
      `${prefix} Batch ${i + 1}: ${res.submittedCount} URLs -> Status ${res.status} (${res.statusText})`
    );
    if (res.message) {
      console.log(`  Details: ${res.message}`);
    }
    if (!res.ok) {
      allOk = false;
    }
  }

  if (syncEvent && notificationPath && completionPath && notificationScope) {
    const receipt = { schemaVersion: "uapt-policy-surface-receipt-v1", surface: "notifications", basisSha256: syncEvent.basisSha256, checkedAt: new Date().toISOString(), checkedSlugs: notificationScope.universities.map((u) => u.slug), checks: { requestRecorded: true, responsesRecorded: true, indexingNotAssumed: true }, urls: finalUrls, results, status: allOk ? "accepted" : "failed", indexingConfirmed: false };
    const bytes = `${JSON.stringify(receipt, null, 2)}\n`;
    fs.writeFileSync(notificationPath, bytes);
    const completion = { ...syncEvent, eventId: `${syncEvent.eventId}-indexnow-${Date.now()}`, generatedAt: new Date().toISOString(), surfaces: { ...(syncEvent.surfaces as Record<string, unknown>), notifications: { status: allOk ? "updated" : "failed", evidence: [{ path: path.basename(notificationPath), sha256: createHash("sha256").update(bytes).digest("hex"), basisSha256: syncEvent.basisSha256 }] } } };
    fs.writeFileSync(completionPath, `${JSON.stringify(completion, null, 2)}\n`, { flag: "wx" });
    if (allOk) runSyncGate(completionPath, "complete");
  }

  if (dryRun) {
    console.log("\n[Dry run complete] No changes made to search engines.");
  } else if (allOk) {
    console.log("\nIndexNow submission succeeded! Search engines have been notified.");
  } else {
    console.error("\nSome batches failed. Please check the logs above.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("IndexNow submission script failed:", err);
  process.exit(1);
});
