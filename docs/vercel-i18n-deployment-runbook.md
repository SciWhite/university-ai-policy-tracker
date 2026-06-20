# Vercel i18n Deployment Runbook

> Legacy note: production now deploys to OCI behind Cloudflare. Use this
> Vercel runbook only for historical debugging or explicit preview work.

Short notes for future agents maintaining the localized web app.

## What Broke

The i18n rollout exposed three separate deployment failure modes:

1. Localized detail pages re-exported `generateStaticParams`, increasing static generation from about 9,061 to 9,877 pages. Vercel timed out after 45 minutes.
2. Making those localized detail routes dynamic fixed the timeout, but Vercel Functions then missed repo-root files such as `data/public-releases/current.json` and `DATA_DICTIONARY.md`.
3. Tracing repo-root data directly with `outputFileTracingIncludes` / `outputFileTracingRoot` caused Vercel to reject the Serverless Function package, likely because of pnpm/workspace symlinked directories.

## Final Fix

Keep localized detail routes dynamic, but package only plain app-local runtime data:

- `scripts/prepare-web-runtime-data.mjs` copies public release data into `apps/web/.runtime-data`.
- `apps/web/lib/repo-root.ts` prefers `apps/web/.runtime-data` at runtime and falls back to the repo root locally.
- `apps/web/package.json` runs the data copy before `next build`.
- `apps/web/next.config.ts` traces only `.runtime-data/**/*`.
- `.gitignore` excludes `apps/web/.runtime-data/`.

Do not commit `.runtime-data`; it is a build artifact.

## Do Not Reintroduce

- Do not re-export `generateStaticParams` from localized detail pages unless you are willing to pay the full static page cost.
- Do not trace `../../data/**` or `../../staging/**` directly from Vercel Functions.
- Do not add localized routes for `/api`, `/feeds`, `/widgets`, `.json`, `.xml`, `.js`, or `.txt`.
- Do not assume a local `next build` proves Vercel packaging works; Vercel packaging has its own constraints.

## Validation Checklist

Local:

```bash
pnpm --filter @uapt/web typecheck
pnpm --filter @uapt/web build
```

Expected build shape:

- Static generation should remain around `9079/9079`.
- Localized detail pages should show as dynamic (`ƒ`), not large new SSG sets.

Legacy Vercel preview/debug only:

```bash
vercel inspect <deployment-url> --logs
```

Look for:

- `Cloning ... Commit: <expected commit>`
- `Generating static pages ... (9079/9079)`
- `Deployment completed`
- `status ● Ready`

Smoke URLs:

```text
https://eduaipolicy.org/zh
https://eduaipolicy.org/zh/changes
https://eduaipolicy.org/zh/datasets
https://eduaipolicy.org/api/public/v1/index.json
https://eduaipolicy.org/sitemap.xml
```

Expected:

- `/zh` shows 788 records, not 0.
- `/zh/changes` and `/zh/datasets` return 200.
- API routes remain unlocalized.
- Browser `Accept-Language` may show a suggestion, but must not force redirect.

## Sitemap Notes

The localized core sitemap matrix is:

```text
locales: zh, fr, pl, es, nl, ms
paths: /, /search, /universities, /analysis, /changes, /datasets, /methodology, /contribute, /citation
```

That is 54 localized core URLs. Keep this matrix in `apps/web/app/sitemap.ts`.

## Operational Notes

Vercel builds are slow for this project because thousands of pages are generated with one worker. Poll at low frequency and prefer deployment URLs over repeatedly hitting the public site alias.
