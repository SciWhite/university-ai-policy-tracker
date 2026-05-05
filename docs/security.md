# Security

This project is public-data oriented, but it still needs strict separation because crawlers and automation agents can be high risk.

Canonical public domain: `https://eduaipolicy.org`. The domain is managed through Cloudflare; crawler automation must not receive broad Cloudflare or deployment credentials.

## Non-Negotiable Boundary

OpenClaw runs with high-risk bypass/root-like automation permissions. Do not deploy the public website, production API, PostgreSQL, Redis, or canonical data store on the OpenClaw server.

## Secrets

- Do not commit `.env` files.
- Commit `.env.example` with variable names only.
- Keep OpenClaw ingestion credentials narrow and revocable.
- Rotate ingestion credentials if an agent workspace or browser profile is exposed.
- Do not store database superuser credentials in OpenClaw.

## Public API

- Separate public read endpoints from internal ingestion endpoints.
- Protect ingestion endpoints with scoped credentials.
- Validate all ingestion payloads with shared schemas before writing to the database.
- Log ingestion actor, source, target university, and snapshot IDs.

## Crawler Safety

- Respect robots.txt and rate limits.
- Do not bypass access controls.
- Keep raw browser profiles and screenshots out of Git.
- Treat downloaded PDFs and HTML as untrusted input.

## Data Integrity

- Preserve source URL, fetched timestamp, hash, and review state.
- Keep official policy records separate from any future student report layer.
- Do not let unreviewed machine extraction overwrite reviewed public conclusions.
