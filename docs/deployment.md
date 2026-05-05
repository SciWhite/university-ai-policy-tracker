# Deployment

No deployment is configured in the initial scaffold.

Canonical public domain: `https://eduaipolicy.org`. The domain has been purchased and added to Cloudflare; deployment should point this domain at the selected web target after preview validation.

## Target Environments

### Public Web

Preferred target: Vercel project for `apps/web`.

Alternative target: separate OCI web host behind Caddy or Nginx.

Production web environment should set:

```text
NEXT_PUBLIC_SITE_URL=https://eduaipolicy.org
WEB_PUBLIC_BASE_URL=https://eduaipolicy.org
```

If the API is hosted separately, set `API_PUBLIC_BASE_URL` to the public API origin. If the web app serves public JSON directly, `API_PUBLIC_BASE_URL` can remain aligned with `https://eduaipolicy.org`.

### Public Data/API

Recommended target: separate OCI host for:

- PostgreSQL
- Redis
- `apps/api`
- `apps/worker`

### OpenClaw Automation

OpenClaw should stay on its own OCI server and use limited ingestion credentials only. It should not hold production database superuser credentials or website deployment credentials.

## First Deployment Steps Later

1. Pin and install dependencies.
2. Add CI for typecheck, build, and basic tests.
3. Provision PostgreSQL and Redis on the public data/API host.
4. Apply Prisma migrations.
5. Deploy `apps/api` and `apps/worker`.
6. Deploy `apps/web` to Vercel or a separate web host.
7. Configure OpenClaw with limited ingestion credentials.
8. Verify sitemap, robots.txt, metadata, API health, and ingestion audit logs.

## Do Not Deploy Yet

The first commit should establish repository hygiene, docs, taxonomy, and data contracts only.
