# OCI Production Deployment

This document records the production migration from Vercel to an OCI origin.
Production deploys should use OCI; Vercel is no longer a production dependency.

## Current State

As of 2026-06-20, the web app is deployed on the existing shared OCI server
used by the CELPIP project. Do not create a new OCI instance for this site.

```text
Cloudflare DNS/CDN/WAF
  -> OCI public IP 129.153.56.227
  -> nginx
  -> uapt-web.service
  -> Next.js on 127.0.0.1:3100
```

Isolation from the CELPIP service:

- Linux user: `uapt`
- App directory: `/srv/uapt/app`
- Env directory: `/srv/uapt/env`
- Env file: `/srv/uapt/env/production.env`
- Logs: `journalctl -u uapt-web.service` and `/var/log/nginx/uapt-*.log`
- Systemd service: `uapt-web.service`
- Nginx site: `/etc/nginx/sites-available/uapt-eduaipolicy.org.conf`
- Nginx enabled symlink:
  `/etc/nginx/sites-enabled/uapt-eduaipolicy.org.conf`
- Nginx cache: `/var/cache/nginx/uapt`
- Node runtime: `/opt/node-v22`

The existing CELPIP runtime remains separate:

- Directory: `/var/www/clb-pro`
- Service: `clb-pro-mock-exam`
- Ports: `127.0.0.1:9000` through `9003`, plus related worker ports

Do not reuse CELPIP directories, env files, service names, or ports for UAPT.

## Runtime Environment

`/srv/uapt/env/production.env` is owned by `uapt:uapt` and mode `0600`.
Do not print, copy into Git, or commit this file.

Required public values:

```text
NODE_ENV=production
PORT=3100
HOSTNAME=127.0.0.1
NEXT_PUBLIC_SITE_URL=https://eduaipolicy.org
WEB_PUBLIC_BASE_URL=https://eduaipolicy.org
API_PUBLIC_BASE_URL=https://eduaipolicy.org
INTERNAL_NEXT_BASE_URL=http://127.0.0.1:3100
```

Private values:

```text
INTERNAL_ANALYTICS_PASSWORD=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_ANALYTICS_SECRET=...
```

The private analytics dashboard is protected with basic auth user `uapt` and
the password in `INTERNAL_ANALYTICS_PASSWORD`.
After five failed login attempts from the same client/user key, the proxy
returns `429` for 15 minutes. The lockout is intentionally in-process and is
cleared by a service restart.

`INTERNAL_NEXT_BASE_URL` is used only for server-side self-fetches so dynamic
routes and build-time data reads do not loop through Cloudflare. Keep public
URL variables pointed at `https://eduaipolicy.org`.
Set `UAPT_DISABLE_INTERNAL_FETCH=1` only during `next build` so prerendering
uses local staged/runtime data rather than HTTP self-fetches.

Do not set `CATALOG_API_BASE_URL` unless a separate catalog API is deployed.
When it is unset, catalog pages use local staged/seed data instead of fetching
the same Next.js HTML routes through HTTP.

The analytics mirror stores only coarse request-derived geography and device
classification. nginx forwards `CF-IPCountry`, `User-Agent`,
`Sec-CH-UA-Mobile`, and `Sec-CH-UA-Platform` to Next.js. The application stores
country code and device type only; it does not store raw IPs or full user-agent
strings.

## Build And Restart

Use the existing SSH key documented in the CELPIP repository README. From the
server:

```bash
sudo -u uapt env HOME=/srv/uapt git -C /srv/uapt/app fetch origin main
sudo -u uapt env HOME=/srv/uapt git -C /srv/uapt/app checkout main
sudo -u uapt env HOME=/srv/uapt git -C /srv/uapt/app reset --hard origin/main

sudo -u uapt env HOME=/srv/uapt PATH=/opt/node-v22/bin:$PATH \
  bash -lc 'cd /srv/uapt/app && pnpm install --frozen-lockfile'

sudo -u uapt env HOME=/srv/uapt PATH=/opt/node-v22/bin:$PATH \
  bash -lc 'set -a; source /srv/uapt/env/production.env; set +a; export UAPT_DISABLE_INTERNAL_FETCH=1; cd /srv/uapt/app && pnpm --filter @uapt/web build'

sudo systemctl restart uapt-web.service
```

Status checks:

```bash
systemctl status uapt-web.service --no-pager
sudo ss -tulpn | grep ':3100'
curl -fsS -I http://127.0.0.1:3100/
```

The service must listen only on `127.0.0.1:3100`.

## Nginx

UAPT nginx files:

```text
/etc/nginx/conf.d/uapt-cache-zones.conf
/etc/nginx/sites-available/uapt-eduaipolicy.org.conf
/etc/nginx/sites-enabled/uapt-eduaipolicy.org.conf
/etc/nginx/snippets/uapt-proxy-common.conf
/etc/nginx/snippets/uapt-proxy-locations.conf
```

The nginx config adds origin-side cache and basic IP rate limits for:

```text
/api/public/v1/*
/api/public/v1/search.json
/datasets*
/feeds/*
/sitemap.xml
/robots.txt
/search*
/sources*
```

Before changing nginx:

```bash
TS="$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "/etc/nginx/backups/uapt/$TS"
sudo sh -c "nginx -T > /etc/nginx/backups/uapt/$TS/nginx-T.before.txt 2>&1"
```

After changing nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Origin Verification Before DNS

Run these on the server before changing Cloudflare DNS:

```bash
curl -fsS -H 'Host: eduaipolicy.org' http://127.0.0.1/ >/dev/null
curl -fsS -H 'Host: eduaipolicy.org' http://127.0.0.1/zh >/dev/null
curl -fsS -H 'Host: eduaipolicy.org' http://127.0.0.1/api/public/v1/index.json >/dev/null
curl -fsS -H 'Host: eduaipolicy.org' http://127.0.0.1/api/public/v1/universities.json >/dev/null
curl -fsS -H 'Host: eduaipolicy.org' 'http://127.0.0.1/api/public/v1/search.json?q=stanford' >/dev/null
curl -fsS -H 'Host: eduaipolicy.org' http://127.0.0.1/sitemap.xml >/dev/null
```

2026-06-17 verification passed for all six URLs with HTTP 200 on commit
`d39f748`.

2026-06-20 verification passed after the analytics geo/device deployment for:
`/`, `/zh`, `/api/public/v1/index.json`,
`/api/public/v1/universities.json`, `/api/public/v1/search.json?q=stanford`,
and `/sitemap.xml`.

## Cloudflare DNS Cutover

Do not assume an agent has Cloudflare permissions. If DNS must be changed
manually in the dashboard:

1. Open the Cloudflare zone for `eduaipolicy.org`.
2. Go to DNS records.
3. Set `A` record `@` to `129.153.56.227`, proxied with the orange cloud.
4. Set `www` as either a proxied `CNAME` to `eduaipolicy.org` or a proxied
   `A` record to `129.153.56.227`.
5. Keep Cloudflare WAF/CDN enabled.
6. Set SSL/TLS mode to `Full` if using the temporary self-signed origin cert.
7. For `Full (strict)`, first create a Cloudflare Origin Certificate covering
   `eduaipolicy.org` and `www.eduaipolicy.org`, install it on the server, and
   update the nginx `ssl_certificate` and `ssl_certificate_key` paths.

Current nginx has a temporary self-signed origin certificate:

```text
/etc/ssl/certs/eduaipolicy.org-selfsigned.pem
/etc/ssl/private/eduaipolicy.org-selfsigned.key
```

This is enough for Cloudflare SSL/TLS `Full`, but not for `Full (strict)`.

## Post-Cutover Verification

After Cloudflare DNS points to OCI:

```bash
curl -fsS -I https://eduaipolicy.org/
curl -fsS -I https://www.eduaipolicy.org/
curl -fsS https://eduaipolicy.org/api/public/v1/index.json >/dev/null
curl -fsS https://eduaipolicy.org/api/public/v1/universities.json >/dev/null
curl -fsS 'https://eduaipolicy.org/api/public/v1/search.json?q=stanford' >/dev/null
curl -fsS https://eduaipolicy.org/sitemap.xml >/dev/null
```

Also confirm the old CELPIP service is still healthy:

```bash
systemctl is-active clb-pro-mock-exam nginx
curl -fsS http://127.0.0.1:9000/api/ai-score/health
```

## Rollback

Fastest rollback is DNS-level:

1. Change Cloudflare `@` and `www` records back to the last known Vercel target.
2. Leave `uapt-web.service` running while DNS propagates unless it is causing
   local resource pressure.

Origin rollback for a bad deploy:

```bash
sudo -u uapt env HOME=/srv/uapt git -C /srv/uapt/app reset --hard <known-good-commit>
sudo -u uapt env HOME=/srv/uapt PATH=/opt/node-v22/bin:$PATH \
  bash -lc 'set -a; source /srv/uapt/env/production.env; set +a; export UAPT_DISABLE_INTERNAL_FETCH=1; cd /srv/uapt/app && pnpm --filter @uapt/web build'
sudo systemctl restart uapt-web.service
```

Nginx rollback:

```bash
sudo cp /etc/nginx/backups/uapt/<timestamp>/nginx-T.before.txt /tmp/nginx-T.before.txt
```

The backup dump is for inspection. Restore individual files from the matching
backup if a future change adds a full file backup; otherwise revert the UAPT
site/snippet edits manually and run `sudo nginx -t` before reload.
