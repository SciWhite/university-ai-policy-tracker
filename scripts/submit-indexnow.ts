import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_INDEXNOW_KEY,
  DEFAULT_INDEXNOW_HOST,
  DEFAULT_INDEXNOW_BASE_URL,
  DEFAULT_INDEXNOW_ENDPOINT,
  getLatestReleaseIndexNowUrls,
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
  --key <key>             Override IndexNow API key (default: ${DEFAULT_INDEXNOW_KEY})
  --host <host>           Override host (default: ${DEFAULT_INDEXNOW_HOST})
  --base-url <url>        Override base URL (default: https://<host>)
  --endpoint <url>        Override IndexNow endpoint (default: ${DEFAULT_INDEXNOW_ENDPOINT})
  --help                  Show this help message

Examples:
  # Dry-run test of latest release changes:
  pnpm indexnow:dry-run

  # Submit latest release changes to Bing / IndexNow:
  pnpm indexnow:latest

  # Submit full site URLs:
  pnpm indexnow:all

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
  const finalUrls = Array.from(new Set(urls.map((u) => normalizeIndexNowUrl(u, baseUrl))));

  console.log(`\nTotal unique URLs to submit: ${finalUrls.length}`);
  console.log("Sample URLs (up to 10):");
  finalUrls.slice(0, 10).forEach((u, i) => console.log(`  ${i + 1}. ${u}`));
  if (finalUrls.length > 10) {
    console.log(`  ... and ${finalUrls.length - 10} more`);
  }

  console.log("\nSubmitting to IndexNow...");
  const results = await submitToIndexNow({
    urls: finalUrls,
    key,
    host,
    dryRun,
    endpoint
  });

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
