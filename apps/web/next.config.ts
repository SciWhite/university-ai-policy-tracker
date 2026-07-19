import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";

const publicDataTraceFiles = [".runtime-data/**/*"];
const appRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(appRoot, "../..");

const nextConfig: NextConfig = {
  staticPageGenerationTimeout: 180,
  experimental: {
    cpus: 2,
    memoryBasedWorkersCount: false,
    staticGenerationMaxConcurrency: 2,
    staticGenerationMinPagesPerWorker: 50
  },
  turbopack: {
    root: workspaceRoot
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
    "/[locale]/universities": publicDataTraceFiles,
    "/[locale]/universities/[slug]": publicDataTraceFiles,
    "/api/public/v1/**/*": publicDataTraceFiles
  }
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
