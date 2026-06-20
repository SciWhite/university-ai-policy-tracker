# Deployment

Canonical public domain: `https://eduaipolicy.org`. DNS and edge protection are
managed through Cloudflare. Production is deployed on the existing shared OCI
server at `129.153.56.227`, not Vercel.

## Target Environments

### Public Web

Production target: OCI origin behind nginx and Cloudflare.

```text
Cloudflare -> OCI 129.153.56.227 -> nginx -> uapt-web.service -> Next.js 127.0.0.1:3100
```

Vercel is not a production dependency. Use it only for explicit preview/debug
work if a task asks for that.

Production web environment should set:

```text
NEXT_PUBLIC_SITE_URL=https://eduaipolicy.org
WEB_PUBLIC_BASE_URL=https://eduaipolicy.org
```

If the API is hosted separately, set `API_PUBLIC_BASE_URL` to the public API origin. If the web app serves public JSON directly, `API_PUBLIC_BASE_URL` can remain aligned with `https://eduaipolicy.org`.

### Production Deploy Flow

The normalized flow is repo-first, then OCI pulls:

1. Make and verify changes locally.
2. Commit and push to GitHub `origin/main`.
3. SSH to OCI and run the `/srv/uapt/app` fetch/reset flow documented in
   `docs/oci-production-deployment.md`.
4. Run `pnpm install --frozen-lockfile`, build `apps/web`, restart
   `uapt-web.service`, then verify public URLs.

### OpenClaw Automation

OpenClaw should stay on its own OCI server and use limited ingestion credentials only. It should not hold production database superuser credentials or website deployment credentials.

## Verification

After each production deploy, verify:

- `systemctl is-active uapt-web.service nginx`
- `https://eduaipolicy.org/`
- `https://www.eduaipolicy.org/`
- `https://eduaipolicy.org/zh`
- `https://eduaipolicy.org/api/public/v1/index.json`
- `https://eduaipolicy.org/api/public/v1/universities.json`
- `https://eduaipolicy.org/api/public/v1/search.json?q=stanford`
- `https://eduaipolicy.org/sitemap.xml`
- `https://eduaipolicy.org/internal/analytics` with basic auth
