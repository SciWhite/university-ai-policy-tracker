# [DEPRECATED] Vercel i18n Deployment Runbook

> [!WARNING]
> **STATUS: ARCHIVED / DO NOT USE FOR PRODUCTION**
> Production deployment for University AI Policy Tracker has permanently migrated from Vercel to OCI (Oracle Cloud Infrastructure, origin at `129.153.56.227` behind Cloudflare and Nginx) as of 2026-06-20.
>
> Vercel is no longer used for production deployments due to historical build timeouts caused by static page generation scale (5,000+ pages) and monorepo workspace data tracing constraints.

## Current Authoritative Deployment Documentation

For all production deployments, operational workflows, and environment setup, refer exclusively to:

1. **[docs/deployment.md](deployment.md)** — Core deployment architecture, public domain specs, Cloudflare proxy setup, and production deploy flow.
2. **[docs/oci-production-deployment.md](oci-production-deployment.md)** — Production host operations, systemd service management (`uapt-web.service`), Nginx site configuration, environment variables, and build/restart procedures.
3. **[docs/maintenance-oci-runbook.md](maintenance-oci-runbook.md)** — Maintenance candidate promotions and crawler ingestion on OCI.
