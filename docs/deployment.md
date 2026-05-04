# Deployment

No deployment is configured in the initial scaffold.

## Target Environments

### Public Web

Preferred target: Vercel project for `apps/web`.

Alternative target: separate OCI web host behind Caddy or Nginx.

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
