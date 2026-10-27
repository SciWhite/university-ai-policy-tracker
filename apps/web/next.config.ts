import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";

const publicDataTraceFiles = [
  ".runtime-data/**/*",
  "../../data/ranking-browser/*.json",
  "../../data/public-v6-pages/sharded/**/*.json",
  "../../data/public-v6-records/sharded/**/*.json",
  "../../data/public-v6-history/sharded/**/*.json",
  "../../data/public-v6-history/repairs/**/*.json",
  "../../data/public-change-history/**/*.json",
  "../../data/public-change-summaries/**/*.json",
  "../../data/public-v6-change-overviews/**/*.json",
  "lib/change-events.ts",
  "../tulsa-zone/components/v6-compact-change-note.tsx",
  "../tulsa-zone/components/mit-student-guide-change-note.tsx",
  "../tulsa-zone/components/imperial-ux-change-note.tsx",
];
const appRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(appRoot, "../..");

const nextConfig: NextConfig = {
  staticPageGenerationTimeout: 180,
  experimental: {
    cpus: 1,
    globalNotFound: true,
    memoryBasedWorkersCount: false,
    webpackMemoryOptimizations: true,
    webpackBuildWorker: true,
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
