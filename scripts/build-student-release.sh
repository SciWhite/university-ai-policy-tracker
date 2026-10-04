#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Build requires a clean, committed release checkout." >&2
  exit 1
fi
# Set these from the actual mailbox setup, not a guessed provider or retention policy.
: "${UAPT_SUPPORT_EMAIL_PROVIDER:?Business email provider must be confirmed}"
: "${UAPT_SUPPORT_EMAIL_RETENTION:?Actual mailbox retention settings must be confirmed}"
: "${UAPT_MAIL_VERIFICATION_FILE:?Provide the completed mailbox verification report}"
node --input-type=module <<'JS'
import {readFileSync} from 'node:fs';
const site=new URL(process.env.NEXT_PUBLIC_SITE_URL ?? '');
if(site.protocol !== 'https:' || !['eduaipolicy.org','www.eduaipolicy.org'].includes(site.hostname) || site.port || site.username || site.password)throw new Error('Production site URL must be the verified public HTTPS domain');
const report=JSON.parse(readFileSync(process.env.UAPT_MAIL_VERIFICATION_FILE,'utf8'));
if(report.address !== 'support@eduaipolicy.org' || report.inboundTest !== 'passed' || report.outboundTest !== 'passed' || report.authenticationHeaders !== 'passed')throw new Error('Mailbox send/receive acceptance is incomplete');
if(['mx','spf','dkim','dmarc'].some(kind=>report[kind]?.status !== 'present'))throw new Error('Mailbox DNS acceptance is incomplete');
const registry=readFileSync('apps/web/lib/monthly-report-registry.ts','utf8');
if(!registry.includes('"2026-09":') || !registry.includes('september2026ReportDraft'))throw new Error('Activate September with the real publication timestamp before building');
JS
pnpm install --frozen-lockfile
pnpm db:generate
pnpm mcp:export
pnpm test:mcp
pnpm exec tsx --test tests/analytics-preference.test.ts
pnpm exec tsx --tsconfig apps/web/tsconfig.json --test \
  tests/policy-reference-preview.test.tsx tests/student-first-policy-pages.test.tsx \
  tests/index-recovery-pilot.test.ts tests/visual-assets.test.ts tests/v4-ready-expansion.test.tsx
pnpm --filter @uapt/mcp typecheck
pnpm validate:i18n
pnpm validate:policy-snapshot
pnpm validate:dataset-release
pnpm --filter @uapt/web typecheck
# One whole-site production build for the combined release.
UAPT_DISABLE_INTERNAL_FETCH=1 pnpm --filter @uapt/web build
node scripts/check-student-build.mjs
