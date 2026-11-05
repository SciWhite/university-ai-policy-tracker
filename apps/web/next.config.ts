import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Workspace-mode builds only. With UAPT_CONTENT_ROOT the program reads the
// active content release at runtime and ships none of these (R1-b).
const publicDataTraceFiles = [
  ".runtime-data/**/*",
  "../../data/*.json",
  "../../data/monthly-reports/*.json",
  "../../data/public-analysis-repairs/*.json",
  "../../data/public-record-repairs/**/*.json",
  "../../data/public-v6-pages/*.json",
  "../../data/public-v6-records/*.json",
  "../../data/public-v6-history/*.json",
  "../../data/ranking-browser/*.json",
  "../../data/public-v6-pages/sharded/**/*.json",
  "../../data/public-v6-records/sharded/**/*.json",
  "../../data/public-v6-history/sharded/**/*.json",
  "../../data/public-v6-history/repairs/**/*.json",
  "../../data/public-change-history/**/*.json",
  "../../data/public-change-summaries/**/*.json",
  "../../data/public-v6-change-overviews/**/*.json",
];
const appRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(appRoot, "../..");

const nextConfig: NextConfig = {
  staticPageGenerationTimeout: 180,
  // University and localized home pages render on first request (ISR). Keep
  // that runtime cache in a bounded in-memory LRU: flushing every school x
  // locale page (~1-2MB each) to .next would grow without limit on the shared
  // host's disk. Cloudflare holds the long-lived copies; build output is unchanged.
  cacheMaxMemorySize: 256 * 1024 * 1024,
  experimental: {
    isrFlushToDisk: false,
    cpus: 1,
    globalNotFound: true,
    memoryBasedWorkersCount: false,
    webpackMemoryOptimizations: true,
    webpackBuildWorker: true,
    // One ordinary render attempt; Next's internal timeout recovery is separate.
    staticGenerationRetryCount: 1,
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 50,
  },
  turbopack: {
    root: workspaceRoot,
  },
  transpilePackages: ["@uapt/db", "@uapt/shared"],
  outputFileTracingRoot: workspaceRoot,
  outputFileTracingIncludes: {
    "/[locale]": publicDataTraceFiles,
    "/[locale]/**/*": publicDataTraceFiles,
    "/[locale]/analysis": publicDataTraceFiles,
    "/[locale]/analysis/[slug]": publicDataTraceFiles,
    "/[locale]/changes": publicDataTraceFiles,
    "/[locale]/changes/[releaseId]": publicDataTraceFiles,
    "/[locale]/changes/[releaseId]/[slug]": publicDataTraceFiles,
    "/[locale]/datasets": publicDataTraceFiles,
    "/rankings": publicDataTraceFiles,
    "/rankings/[slug]": publicDataTraceFiles,
    "/universities": publicDataTraceFiles,
    "/[locale]/rankings": publicDataTraceFiles,
    "/[locale]/rankings/[slug]": publicDataTraceFiles,
    "/[locale]/universities": publicDataTraceFiles,
    "/[locale]/universities/[slug]": publicDataTraceFiles,
    "/api/public/v1/**/*": publicDataTraceFiles,
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
