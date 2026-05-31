import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const publicDataTraceFiles = [
  "../../package.json",
  "../../DATA_DICTIONARY.md",
  "../../data/public-releases/**/*.json",
  "../../data/rankings/**/*.json",
  "../../data/openclaw-staging/**/*.json",
  "../../staging/uapt-runs/**/*.json"
];

const nextConfig: NextConfig = {
  transpilePackages: ["@uapt/shared"],
  outputFileTracingIncludes: {
    "/[locale]": publicDataTraceFiles,
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
