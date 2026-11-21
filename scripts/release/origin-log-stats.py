#!/usr/bin/env python3
"""Read-only daily origin statistics from the uapt nginx access log (docs/stop-bleed-set2-20261121.md).

Counts per UTC day: requests, 5xx, requests from 43.172/16 and 43.173/16, requests with
`returnTo`; and, for lines in the uapt_timed format (since 2026-11-21 21:38 UTC), the nginx cache
status share and p50/p95 upstream time per route family. Reads plain or .gz logs.

  python3 origin-log-stats.py /var/log/nginx/uapt-access.log [/var/log/nginx/uapt-access.log.1 ...] [--day 21/Nov/2026]
"""
import argparse, collections, gzip, json, re, sys

LINE = re.compile(r'^(\S+) \S+ \S+ \[(\d+/\w+/\d+):[^\]]*\] "(?:\S+) (\S+)[^"]*" (\d{3}) .*?(?: uc=(\S*) ut=(\S*) rt=(\S*))?$')
FAMILY = [('universities', re.compile(r'^(?:/[a-z]{2}(?:-[A-Za-z]+)?)?/universities/')), ('changes', re.compile(r'^(?:/[a-z]{2}(?:-[A-Za-z]+)?)?/changes/')),
          ('api', re.compile(r'^/api/'))]


def family(path):
    return next((name for name, rx in FAMILY if rx.match(path)), 'other')


def pct(values, q):
    if not values: return None
    values = sorted(values); return values[min(len(values) - 1, int(q * len(values)))]


def stats(lines, day=None):
    days = collections.defaultdict(lambda: {'requests': 0, 's504': 0, 's502': 0, 's500': 0, 'tencent': 0, 'returnTo': 0,
                                            'timed': 0, 'cache': collections.Counter(), 'ut': collections.defaultdict(list)})
    for line in lines:
        m = LINE.match(line.rstrip('\n'))
        if not m: continue
        ip, d, path, status, uc, ut, _rt = m.groups()
        if day and d != day: continue
        row = days[d]; row['requests'] += 1
        if status in ('504', '502', '500'): row['s' + status] += 1
        if ip.startswith(('43.172.', '43.173.')): row['tencent'] += 1
        if 'returnTo=' in path: row['returnTo'] += 1
        if uc is not None:
            row['timed'] += 1; row['cache'][uc or '-'] += 1
            try: row['ut'][family(path.split('?')[0])].append(float(ut.split(',')[-1].strip()))
            except ValueError: pass
    out = {}
    for d, row in sorted(days.items()):
        out[d] = {k: row[k] for k in ('requests', 's504', 's502', 's500', 'tencent', 'returnTo', 'timed')}
        if row['timed']:
            out[d]['cacheShare'] = {k: round(v / row['timed'], 3) for k, v in row['cache'].most_common()}
            out[d]['upstreamSeconds'] = {f: {'n': len(v), 'p50': pct(v, .5), 'p95': pct(v, .95)} for f, v in sorted(row['ut'].items())}
    return out


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('logs', nargs='+'); parser.add_argument('--day', help='e.g. 21/Nov/2026')
    args = parser.parse_args(argv)
    def lines():
        for name in args.logs:
            with (gzip.open(name, 'rt', errors='replace') if name.endswith('.gz') else open(name, errors='replace')) as stream:
                yield from stream
    print(json.dumps(stats(lines(), args.day), indent=2))


if __name__ == '__main__':
    sys.exit(main())
