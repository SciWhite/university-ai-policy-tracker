#!/usr/bin/env python3
"""Warm the changed pages of a content switch on the origin before the cache purge and the public
readback (docs/content-release.md §5).

After `content:switch` expires the changed pages, their next render is cold (10–110 s on the
production host). A Cloudflare purge_everything sends the first public request straight to that
cold render, and Cloudflare gives up after about 100 s with HTTP 524 (2026-11-21 batch 3: Chalmers
and Ghent). This script requests every changed path once over loopback, one at a time, so the
readback finds rendered ISR entries.

Run on the host as the deploy user (no root, no secrets, loopback only):
  python3 warm-changed-pages.py --plan <release>/switch-<time>.json --path /universities/x --receipt warm.json
Readback paths given with --path go first. The routed slot is read from the nginx upstream.
"""
import argparse, datetime, json, re, sys, time, urllib.error, urllib.request
from pathlib import Path

UPSTREAM = Path('/etc/nginx/snippets/uapt-main-upstream.conf')
SITE_HOST = 'eduaipolicy.org'
SCHEMA = 'uapt-content-warmup-v1'


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl): return None


def routed_origin(text):
    block = re.search(r'upstream\s+uapt_next_backend\s*\{([^}]*)\}', text)
    ports = re.findall(r'server\s+127\.0\.0\.1:(\d+)', block.group(1)) if block else []
    if len(ports) != 1: raise ValueError('Expected exactly one routed web slot in uapt_next_backend, found ' + str(ports))
    return 'http://127.0.0.1:' + ports[0]


def collect_paths(first, files):
    """--path values first (the readback set), then each file's paths; order kept, duplicates dropped."""
    ordered = list(first)
    for file in files:
        data = json.loads(Path(file).read_text())
        rows = data if isinstance(data, list) else data.get('paths', [])
        if not isinstance(rows, list): raise ValueError(f'{file}: expected a list or an object with "paths"')
        ordered += rows
    seen, result = set(), []
    for path in ordered:
        if not isinstance(path, str) or not path.startswith('/') or path.startswith('//'): raise ValueError('Not a site path: ' + repr(path))
        if path not in seen: seen.add(path); result.append(path)
    return result


def fetch(origin, path, timeout, opener):
    request = urllib.request.Request(origin + path, headers={'Host': SITE_HOST, 'X-Forwarded-Proto': 'https', 'User-Agent': 'uapt-content-warmup'})
    started = time.monotonic()
    try:
        with opener(request, timeout=timeout) as response:
            response.read()
            status = response.status
    except urllib.error.HTTPError as error:
        status = error.code; error.close()
    except Exception as error:  # timeout, refused, reset
        return {'status': 0, 'seconds': round(time.monotonic() - started, 2), 'error': type(error).__name__ + ': ' + str(error)[:200]}
    return {'status': status, 'seconds': round(time.monotonic() - started, 2)}


def warmed(status):
    return 200 <= status < 400 or status == 404  # 404: a removed page is answered, not rendering


def warm(origin, paths, *, timeout, max_seconds, opener, clock=time.monotonic):
    started, rows = clock(), []
    for index, path in enumerate(paths):
        if clock() - started > max_seconds:
            rows += [{'path': p, 'status': None, 'skipped': 'time budget'} for p in paths[index:]]
            break
        result = fetch(origin, path, timeout, opener); attempts = 1
        if not warmed(result['status']):
            result = fetch(origin, path, timeout, opener); attempts = 2
        rows.append({'path': path, **result, 'attempts': attempts})
    return rows


def main(argv=None, *, opener=None, upstream=UPSTREAM):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--plan', action='append', default=[], help='switch-<time>.json (its "paths"), or any JSON list / {"paths": [...]}; repeatable')
    parser.add_argument('--path', action='append', default=[], help='a path to warm first (the readback set); repeatable')
    parser.add_argument('--origin', help='default: the routed slot from ' + str(UPSTREAM))
    parser.add_argument('--timeout', type=float, default=180.0, help='seconds per request (cold renders take up to ~110 s)')
    parser.add_argument('--max-seconds', type=float, default=3600.0, help='stop starting new requests after this many seconds')
    parser.add_argument('--receipt', help='write the JSON receipt here')
    args = parser.parse_args(argv)
    opener = opener or urllib.request.build_opener(_NoRedirect).open
    origin = args.origin or routed_origin(Path(upstream).read_text())
    if not re.fullmatch(r'http://127\.0\.0\.1:\d+', origin): raise ValueError('Warm-up is loopback only: ' + origin)
    paths = collect_paths(args.path, args.plan)
    if not paths: raise ValueError('No paths to warm; pass --plan and/or --path')
    begun = datetime.datetime.now(datetime.timezone.utc)
    rows = warm(origin, paths, timeout=args.timeout, max_seconds=args.max_seconds, opener=opener)
    failed = [r['path'] for r in rows if r.get('status') is not None and not warmed(r['status'])]
    skipped = [r['path'] for r in rows if r.get('status') is None]
    receipt = {'schemaVersion': SCHEMA, 'startedAt': begun.isoformat(), 'finishedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'origin': origin, 'plans': args.plan, 'requested': len(paths), 'warmed': len(rows) - len(failed) - len(skipped),
               'failed': failed, 'skipped': skipped, 'slowest': sorted((r for r in rows if r.get('seconds')), key=lambda r: -r['seconds'])[:10], 'rows': rows}
    if args.receipt:
        Path(args.receipt).write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({k: receipt[k] for k in ('origin', 'requested', 'warmed', 'failed', 'skipped')}, indent=2))
    return 1 if failed or skipped else 0


if __name__ == '__main__':
    try: sys.exit(main())
    except Exception as error:
        print('warm-up error: ' + str(error), file=sys.stderr); sys.exit(2)
