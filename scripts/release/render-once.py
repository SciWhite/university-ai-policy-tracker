#!/usr/bin/env python3
"""Render once per release, keep on disk (docs/render-once.md; audit 2026-11-21 phase 2).

Stdlib only, one file, so the release tooling can call it and the host can install it as
/usr/local/libexec/uapt-render-once.py. Every network call is loopback only.

nginx page store (2.2):
  urls        --plan switch.json [--plan ...] [--path /x ...]       expanded URL list (JSON)
  refresh     --plan switch.json [--path ...] [--origin https://127.0.0.1] [--receipt r.json]
              GET every URL through nginx with `X-UAPT-Refresh: 1` (overwrites the stored entry),
              both stored encodings, then read back that nginx now answers it from the store.
              Content-language URLs only (en, zh); UI-locale school URLs are probed and refreshed
              when the store holds a native page (expand_paths, probe_paths).
  generation  --content-id <id> [--file ...] [--log ...] [--dry-run]   (root) new content
              generation for generic pages and RSC variants; nginx -t, reload, restore on failure

Pre-rendered tree (2.3):
  capture     --root <dir> --tree-id <id> --origin <url> [--origin ...] (--paths-file f | --sitemap)
              [--base-tree <id>] [--content-id <id>]   fetch HTML + full RSC payload per page,
              store content-addressed gzip objects, write trees/<id>.json
  materialize --root <dir> --tree-id <id>         hardlink tree for nginx try_files
  activate    --root <dir> --tree-id <id> [--build-id <id>]   atomic `current` symlink swap
  verify      --root <dir> --tree-id <id> --origin <url> [--sample N]   compare with a live render
  diff        <tree-a.json> <tree-b.json>          same / changed / added / removed (dedup check)
"""
import argparse, concurrent.futures, datetime, gzip, hashlib, http.client, json, os, random, re, ssl, subprocess, sys, tempfile, time, urllib.parse
from pathlib import Path

SITE_HOST = 'eduaipolicy.org'
# apps/web/lib/language-catalog.ts READING_LOCALES (a test keeps them equal).
READING_LOCALES = ('en', 'zh', 'fr', 'pl', 'es', 'nl', 'ms', 'ja', 'ko', 'pt', 'ar', 'ru', 'de', 'it',
                   'cs', 'tr', 'fi', 'sv', 'da', 'nb', 'hu', 'lt', 'id', 'vi', 'th', 'fa', 'he', 'hi',
                   'ur', 'bn', 'uk', 'el', 'zh-Hant')
assert all(re.fullmatch(r'[A-Za-z-]+', code) for code in READING_LOCALES)
_LOCALES = '|'.join(READING_LOCALES)
# apps/web/lib/content-locales.ts CONTENT_LOCALES: languages with their own content URLs.
CONTENT_LOCALES = ('en', 'zh')
# School pages and changes pages (index, per school, per release and school) in every locale.
# Their render never reads the query string (force-static or readDevelopmentPreviewQuery).
PAGE_STORE_PATTERN = r'^/(?:(?:' + _LOCALES + r')/)?(?:universities/[a-z0-9]+(?:-[a-z0-9]+)*|changes(?:/[A-Za-z0-9._-]+){0,2})$'
PAGE_STORE_LOCATION = '"' + PAGE_STORE_PATTERN + '"'  # quoted: the pattern contains braces
_PAGE_STORE = re.compile(PAGE_STORE_PATTERN)
_LOCALE_PREFIX = re.compile(r'^/(' + _LOCALES + r')(?=/|$)')
# What the app sends for `revalidate = false` pages; the tree answers with the same value.
TREE_CACHE_CONTROL = 's-maxage=31536000'
TREE_SCHEMA = 'uapt-page-tree-v1'
REFRESH_SCHEMA = 'uapt-page-store-refresh-v1'
GENERATION_FILE = Path('/etc/nginx/conf.d/uapt-html-content-generation.inc')
GENERATION_LOG = Path('/srv/uapt/operations/release-lifecycle/html-content-generations.jsonl')
OK_STATUS = {200, 301, 308, 404, 410}
LOOPBACK = {'127.0.0.1', '::1', 'localhost'}
CONTENT_ID = re.compile(r'^[A-Za-z0-9._-]{1,128}$')
SHA = re.compile(r'^[0-9a-f]{64}$')


def page_store_path(path):
    """True for paths the nginx page store keeps until a release refreshes them."""
    return bool(_PAGE_STORE.match(path))


def strip_locale(path):
    match = _LOCALE_PREFIX.match(path)
    if not match: return None, path
    return match.group(1), path[len(match.group(0)):] or '/'


def localized(base, locale):
    if locale == 'en': return base
    return '/' + locale + ('' if base == '/' else base)


def _check_path(path):
    if not isinstance(path, str) or not path.startswith('/') or path.startswith('//') or len(path) > 512 or any(c in path for c in '?#\\ \t\r\n'):
        raise ValueError('Not a site path: ' + repr(path))
    return path


def read_plan_paths(files):
    paths = []
    for file in files:
        data = json.loads(Path(file).read_text())
        rows = data if isinstance(data, list) else data.get('paths', [])
        if not isinstance(rows, list): raise ValueError(f'{file}: expected a list or an object with "paths"')
        paths += rows
    return paths


def read_reading_changed(files):
    """Union of the switch plans' readingChangedSchools (schools whose reading locales, and so
    their native pages, can appear or disappear); None when no plan carries the field."""
    found = None
    for file in files:
        data = json.loads(Path(file).read_text())
        if isinstance(data, dict) and isinstance(data.get('readingChangedSchools'), list):
            found = (found or set()) | set(data['readingChangedSchools'])
    return found


UI_LOCALES = tuple(l for l in READING_LOCALES if l not in CONTENT_LOCALES)


def _school_slug(base):
    return base[len('/universities/'):] if base.startswith('/universities/') else None


def expand_paths(first, plan_paths, reading_changed=None):
    """The URLs a content release must refresh in the page store, in order: the readback set,
    then every page-store path in the content languages (en, zh), then the UI-locale school
    pages that must be refreshed whatever they are now, then the plan's other paths as listed
    (generic pages go cold with the content generation; fetching them only warms them).

    Only content-language URLs exist (apps/web/lib/content-locales.ts, docs/render-once.md §10):
    every page has en and zh; a school can also have a native-language page. Every other
    /<uiLocale>/... URL is a 301/308 to the English page, so a changed path is not expanded to
    all 33 reading locales. A /<uiLocale>/universities/<slug> URL is refreshed here only when a
    plan lists it and the school's reading locales changed (`reading_changed`; when no plan says,
    every listed one): there a native page can turn into its 308 or back. The other UI-locale
    school URLs are probed (probe_paths). /<uiLocale>/changes... URLs are constant 301s."""
    ordered, seen = [], set()
    def add(path):
        if path not in seen: seen.add(path); ordered.append(path)
    for path in first: add(_check_path(path))
    store, ui_school, other = [], [], []
    for path in map(_check_path, plan_paths):
        locale, base = strip_locale(path)
        if not page_store_path(base): other.append(path)
        elif locale in (None, *CONTENT_LOCALES): store.append(base)
        elif _school_slug(base) and (reading_changed is None or _school_slug(base) in reading_changed): ui_school.append(path)
    for base in store:
        for locale in CONTENT_LOCALES: add(localized(base, locale))
    for path in ui_school: add(path)
    for path in other: add(path)
    return ordered


def probe_paths(plan_paths, refreshed):
    """Every UI-locale URL of every school page in the plans that is not refreshed already. Such a
    URL is the school's native page or a 308 to the English page, and only a reading change (which
    is refreshed) switches between the two. So refresh() reads the stored entry first and
    re-renders only a stored native page (200); a stored redirect stays as it is. A miss is fetched
    and stored fresh by that read. A non-cohort school's native page is listed in en/zh only by
    switch.ts, so without this it would keep the old content for 30 days."""
    done, ordered = set(refreshed), []
    for path in map(_check_path, plan_paths):
        slug = _school_slug(strip_locale(path)[1])
        if not slug or not page_store_path('/universities/' + slug): continue
        for locale in UI_LOCALES:
            url = f'/{locale}/universities/{slug}'
            if url not in done: done.add(url); ordered.append(url)
    return ordered


# ---------------------------------------------------------------- HTTP (loopback only)

class _Conn(http.client.HTTPSConnection):
    """HTTPS to a loopback address with SNI for the site host (nginx picks the site's server)."""
    def __init__(self, host, port, timeout):
        context = ssl.create_default_context(); context.check_hostname = False; context.verify_mode = ssl.CERT_NONE
        super().__init__(host, port, timeout=timeout, context=context)
        self._sni_context = context
    def connect(self):
        http.client.HTTPConnection.connect(self)
        self.sock = self._sni_context.wrap_socket(self.sock, server_hostname=SITE_HOST)


def parse_origin(origin):
    url = urllib.parse.urlsplit(origin)
    if url.scheme not in ('http', 'https') or url.hostname not in LOOPBACK or url.path not in ('', '/') or url.query:
        raise ValueError('Origin must be a loopback http(s) base URL: ' + origin)
    return url.scheme, url.hostname, url.port or (443 if url.scheme == 'https' else 80)


def http_get(origin, path, headers=None, timeout=180.0):
    """GET origin+path; returns (status, headers dict lower-case, body bytes, seconds). Never follows redirects."""
    scheme, host, port = parse_origin(origin)
    conn = _Conn(host, port, timeout) if scheme == 'https' else http.client.HTTPConnection(host, port, timeout=timeout)
    started = time.monotonic()
    try:
        conn.request('GET', path, headers={'Host': SITE_HOST, 'X-Forwarded-Proto': 'https', 'User-Agent': 'uapt-render-once', **(headers or {})})
        response = conn.getresponse()
        body = response.read()
        return response.status, {k.lower(): v for k, v in response.getheaders()}, body, round(time.monotonic() - started, 3)
    finally:
        conn.close()


def _attempt(get, origin, path, headers, timeout):
    try:
        return get(origin, path, headers, timeout)
    except Exception as error:  # timeout, refused, reset, TLS
        return 0, {'error': type(error).__name__ + ': ' + str(error)[:200]}, b'', None


# ---------------------------------------------------------------- page store refresh

def refresh(origin, paths, *, probe=(), timeout=180.0, max_seconds=3600.0, get=http_get, clock=time.monotonic):
    """One request at a time (the app renders on one thread). For each URL: the gzip and the
    identity entry with `X-UAPT-Refresh: 1`, one retry each, then a plain gzip read that must be
    answered by nginx (HIT) for a 200 in the page store. A `probe` URL is first read as stored
    (both encodings, no refresh header) and refreshed only when a stored entry is a 200.
    Returns receipt rows."""
    started, rows = clock(), []
    queue = [(p, False) for p in paths] + [(p, True) for p in probe]
    for index, (path, probing) in enumerate(queue):
        if clock() - started > max_seconds:
            rows += [{'path': p, 'skipped': 'time budget'} for p, _ in queue[index:]]
            break
        row = {'path': path, 'pageStore': page_store_path(strip_locale(path)[1])}
        if probing:
            row['probe'] = {}
            for encoding in ('gzip', 'identity'):
                headers = {'Accept-Encoding': 'gzip'} if encoding == 'gzip' else {}
                status, response, _, _ = _attempt(get, origin, path, headers, timeout)
                if status not in OK_STATUS: status, response, _, _ = _attempt(get, origin, path, headers, timeout)
                row['probe'][encoding] = {'status': status, 'cache': response.get('x-uapt-origin-cache')}
            # A stored (not just fetched) 200 is a native page rendered before the switch.
            if not any(p['status'] == 200 and p['cache'] != 'MISS' for p in row['probe'].values()):
                rows.append(row); continue
        for encoding in ('gzip', 'identity'):
            headers = {'X-UAPT-Refresh': '1', **({'Accept-Encoding': 'gzip'} if encoding == 'gzip' else {})}
            status, response, _, seconds = _attempt(get, origin, path, headers, timeout)
            attempts = 1
            if status not in OK_STATUS:
                status, response, _, seconds = _attempt(get, origin, path, headers, timeout); attempts = 2
            row[encoding] = {'status': status, 'seconds': seconds, 'attempts': attempts, 'cache': response.get('x-uapt-origin-cache'), **({'error': response['error']} if 'error' in response else {})}
        if row['gzip']['status'] == 200:
            status, response, _, _ = _attempt(get, origin, path, {'Accept-Encoding': 'gzip'}, timeout)
            row['readback'] = {'status': status, 'cache': response.get('x-uapt-origin-cache')}
        rows.append(row)
    return rows


def refresh_problems(rows):
    problems = []
    for row in rows:
        if 'skipped' in row: problems.append({'path': row['path'], 'problem': 'skipped (time budget)'}); continue
        for encoding, probe in row.get('probe', {}).items():
            if probe['status'] not in OK_STATUS: problems.append({'path': row['path'], 'problem': f'{encoding} probe status {probe["status"]}'})
        if 'gzip' not in row: continue  # probed, not refreshed: a stored redirect or a fresh fetch
        for encoding in ('gzip', 'identity'):
            if row[encoding]['status'] not in OK_STATUS: problems.append({'path': row['path'], 'problem': f'{encoding} refresh status {row[encoding]["status"]}'})
            elif row[encoding]['cache'] not in ('BYPASS', None) and row[encoding]['status'] == 200:
                problems.append({'path': row['path'], 'problem': f'{encoding} refresh was not a bypass ({row[encoding]["cache"]}); is the page store installed?'})
        if row['pageStore'] and row.get('readback', {}).get('cache') not in (None, 'HIT', 'STATIC') and row['gzip']['status'] == 200:
            problems.append({'path': row['path'], 'problem': f'not stored after refresh (readback {row["readback"]})'})
    return problems


# ---------------------------------------------------------------- content generation (root)

def render_generation(content_id):
    if not CONTENT_ID.match(content_id): raise ValueError('Bad content id: ' + repr(content_id))
    return ('# Written by render-once.py generation (as root) at every content release; the active contentId.\n'
            '# Part of the generic `location /` key and of every RSC key in the page store (docs/render-once.md).\n'
            f'map "" $uapt_html_content_generation {{ default "{content_id}"; }}\n')


def write_generation(content_id, *, file=GENERATION_FILE, log=GENERATION_LOG, reason='', runner=None, dry_run=False):
    """New content generation: write, `nginx -t` (restore on failure), reload, log. Nothing is
    deleted: old generic/RSC entries stop matching and age out (inactive/max_size)."""
    runner = runner or (lambda argv: subprocess.run(argv, capture_output=True, text=True))
    file = Path(file)
    if not file.is_file(): raise ValueError(f'{file} is missing: install the page store first (docs/render-once.md)')
    before, text = file.read_text(), render_generation(content_id)
    previous = (re.search(r'default "([^"]*)"', before) or [None, None])[1]
    record = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'generation': content_id, 'previous': previous, 'reason': reason}
    if dry_run or before == text: return {**record, 'changed': before != text, 'dryRun': dry_run}
    stat = file.stat()
    tmp = file.with_name(file.name + '.tmp')
    tmp.write_text(text); os.chmod(tmp, stat.st_mode & 0o7777)
    try: os.chown(tmp, stat.st_uid, stat.st_gid)
    except PermissionError: pass
    tmp.replace(file)
    test = runner(['nginx', '-t'])
    if test.returncode != 0:
        file.write_text(before)
        raise RuntimeError('nginx -t failed after the content generation change; restored: ' + (test.stderr or '')[-800:])
    reload = runner(['systemctl', 'reload', 'nginx'])
    if reload.returncode != 0: raise RuntimeError('systemctl reload nginx failed: ' + (reload.stderr or '')[-800:])
    record['changed'] = True
    if log:
        with open(log, 'a') as handle: handle.write(json.dumps(record) + '\n')
    return record


# ---------------------------------------------------------------- pre-rendered tree

def _gzip(data):
    return gzip.compress(data, compresslevel=9, mtime=0)


def object_path(root, sha):
    if not SHA.match(sha): raise ValueError('Bad object id: ' + repr(sha))
    return Path(root) / 'objects' / sha[:2] / (sha + '.gz')


def store_object(root, data):
    """Content-addressed: sha256 of the uncompressed bytes; written once, never rewritten."""
    sha = hashlib.sha256(data).hexdigest()
    target = object_path(root, sha)
    if target.exists(): return sha, False, target.stat().st_size
    target.parent.mkdir(parents=True, exist_ok=True)
    packed = _gzip(data)
    fd, tmp = tempfile.mkstemp(dir=target.parent, prefix='.tmp-')
    with os.fdopen(fd, 'wb') as handle: handle.write(packed)
    os.chmod(tmp, 0o644); os.replace(tmp, target)
    return sha, True, len(packed)


BUILD_ID = re.compile(rb'"buildId":"([A-Za-z0-9_-]+)"|\\"b\\":\\"([A-Za-z0-9_-]+)\\"|"b":"([A-Za-z0-9_-]+)"')


def build_id_of(body):
    match = BUILD_ID.search(body)
    return next((g.decode() for g in match.groups() if g), None) if match else None


def capture_page(origin, path, *, get=http_get, timeout=180.0, content_id=None):
    """HTML document and full RSC payload of one page, or a gap with its reason."""
    status, headers, html, seconds = _attempt(get, origin, path, {}, timeout)
    if status != 200: return {'gap': f'html status {status}' + (f' ({headers["error"]})' if 'error' in headers else '')}
    if not headers.get('content-type', '').startswith('text/html'): return {'gap': 'html content-type ' + headers.get('content-type', '')}
    if 'set-cookie' in headers: return {'gap': 'html sets a cookie'}
    cache_control = headers.get('cache-control', '')
    if re.search(r'\b(?:private|no-store)\b', cache_control): return {'gap': 'html is not cacheable: ' + cache_control}
    # Next checks the `_rsc` cache-buster against the router headers (307 otherwise); with no
    # state tree it is empty. A static page's full flight payload does not depend on the tree.
    status, rheaders, rsc, rseconds = _attempt(get, origin, path + '?_rsc', {'RSC': '1'}, timeout)
    if status in (307, 308) and '_rsc' in rheaders.get('location', ''):
        status, rheaders, rsc, rseconds = _attempt(get, origin, rheaders['location'], {'RSC': '1'}, timeout)
    if status != 200 or not rheaders.get('content-type', '').startswith('text/x-component'):
        return {'gap': f'rsc status {status} {rheaders.get("content-type", "")}'.strip()}
    notes = []
    if content_id and content_id.encode() in html: notes.append('html embeds the contentId')
    if content_id and content_id.encode() in rsc: notes.append('rsc embeds the contentId')
    return {'html': html, 'rsc': rsc, 'cacheControl': cache_control, 'buildId': build_id_of(html), 'seconds': (seconds or 0) + (rseconds or 0), 'notes': notes}


def sitemap_paths(origin, *, get=http_get, timeout=180.0):
    """Every <loc> of the site's sitemap index (the indexable set), in order."""
    def locs(body): return [m or '/' for m in re.findall(r'<loc>https://' + re.escape(SITE_HOST) + r'([^<]*)</loc>', body.decode('utf-8', 'replace'))]
    status, _, index, _ = get(origin, '/sitemap.xml', {}, timeout)
    if status != 200: raise RuntimeError(f'/sitemap.xml status {status}')
    seen, out = set(), []
    for section in locs(index):
        status, _, body, _ = get(origin, section, {}, timeout)
        if status != 200: raise RuntimeError(f'{section} status {status}')
        for path in locs(body):
            if path not in seen: seen.add(path); out.append(path)
    return out


def read_tree(root, tree_id):
    data = json.loads((Path(root) / 'trees' / (tree_id + '.json')).read_text())
    if data.get('schemaVersion') != TREE_SCHEMA: raise ValueError('Not a page tree manifest: ' + tree_id)
    return data


def capture(root, tree_id, origins, paths, *, base=None, content_id=None, get=http_get, timeout=180.0, max_seconds=7200.0, clock=time.monotonic):
    """Render `paths` (page-store paths only) on `origins` (one worker per origin: each Next
    process renders on one thread) into content-addressed objects; pages not captured come from
    the base tree. Writes trees/<tree_id>.json and returns it."""
    if not CONTENT_ID.match(tree_id): raise ValueError('Bad tree id: ' + repr(tree_id))
    for origin in origins: parse_origin(origin)
    root = Path(root); (root / 'trees').mkdir(parents=True, exist_ok=True)
    target = root / 'trees' / (tree_id + '.json')
    if target.exists(): raise ValueError(f'{target} exists; tree ids are immutable')
    wanted = [p for p in dict.fromkeys(paths) if page_store_path(strip_locale(p)[1])]
    pages = dict(base['pages']) if base else {}
    gaps, notes, stats = {}, {}, {'requested': len(wanted), 'captured': 0, 'newObjects': 0, 'reusedObjects': 0, 'newBytes': 0, 'renderSeconds': 0.0}
    build_ids, cache_controls = set(), set()
    started = clock()
    def work(item):
        index, path = item
        if clock() - started > max_seconds: return path, {'gap': 'time budget'}
        return path, capture_page(origins[index % len(origins)], path, get=get, timeout=timeout, content_id=content_id)
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(origins)) as pool:
        for path, result in pool.map(work, enumerate(wanted)):
            if 'gap' in result:
                pages.pop(path, None); gaps[path] = result['gap']; continue
            entry = {}
            for kind in ('html', 'rsc'):
                sha, new, size = store_object(root, result[kind])
                entry[kind] = sha
                stats['newObjects' if new else 'reusedObjects'] += 1
                if new: stats['newBytes'] += size
            pages[path] = entry; stats['captured'] += 1; stats['renderSeconds'] += result['seconds']
            if result['buildId']: build_ids.add(result['buildId'])
            cache_controls.add(result['cacheControl'])
            if result['notes']: notes[path] = result['notes']
    if base and base.get('buildId') and build_ids and build_ids != {base['buildId']}:
        raise ValueError(f'Captured build {sorted(build_ids)} differs from the base tree build {base["buildId"]}: capture the full set for a new program')
    if len(build_ids) > 1: raise ValueError('Pages from more than one program build: ' + ', '.join(sorted(build_ids)))
    stats['renderSeconds'] = round(stats['renderSeconds'], 1); stats['wallSeconds'] = round(clock() - started, 1)
    manifest = {'schemaVersion': TREE_SCHEMA, 'treeId': tree_id, 'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'buildId': next(iter(build_ids), base.get('buildId') if base else None), 'contentId': content_id,
                'baseTree': base['treeId'] if base else None, 'cacheControl': sorted(c for c in cache_controls if c),
                'pages': dict(sorted(pages.items())), 'gaps': gaps, 'notes': notes, 'stats': stats}
    tmp = target.with_name(target.name + '.tmp'); tmp.write_text(json.dumps(manifest, indent=1) + '\n'); tmp.replace(target)
    return manifest


def materialize(root, tree_id):
    """trees/<id>/{html,rsc}/<path>/index.<kind>.gz plus a same-inode index.<kind> (nginx
    try_files checks the plain name; gzip_static always serves the .gz). No bytes are copied."""
    root = Path(root); manifest = read_tree(root, tree_id)
    final = root / 'trees' / tree_id
    if final.exists(): raise ValueError(f'{final} exists')
    work = Path(tempfile.mkdtemp(dir=root / 'trees', prefix='.build-' + tree_id + '-'))
    count = 0
    for path, entry in manifest['pages'].items():
        if not page_store_path(strip_locale(path)[1]): raise ValueError('Not a page-store path in the manifest: ' + path)
        for kind in ('html', 'rsc'):
            source = object_path(root, entry[kind])
            if not source.is_file(): raise ValueError(f'Missing object {entry[kind]} for {path}')
            folder = work / kind / path.lstrip('/')
            folder.mkdir(parents=True, exist_ok=True)
            os.link(source, folder / f'index.{kind}.gz'); os.link(source, folder / f'index.{kind}')
            count += 1
    os.chmod(work, 0o755); work.rename(final)
    return {'treeId': tree_id, 'files': count * 2, 'pages': len(manifest['pages'])}


def activate(root, tree_id, *, build_id=None, log=True):
    root = Path(root); manifest = read_tree(root, tree_id)
    if build_id and manifest.get('buildId') != build_id:
        raise ValueError(f'Tree {tree_id} was rendered by build {manifest.get("buildId")}, not {build_id}')
    if not (root / 'trees' / tree_id).is_dir(): raise ValueError('Materialize the tree first')
    current = root / 'current'
    previous = os.readlink(current) if current.is_symlink() else None
    tmp = root / f'.current-{os.getpid()}'
    if tmp.is_symlink() or tmp.exists(): tmp.unlink()
    os.symlink(f'trees/{tree_id}', tmp); os.replace(tmp, current)
    record = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'tree': tree_id, 'previous': previous, 'buildId': manifest.get('buildId'), 'contentId': manifest.get('contentId')}
    if log:
        with open(root / 'activations.jsonl', 'a') as handle: handle.write(json.dumps(record) + '\n')
    return record


def deactivate(root):
    """Rollback to "no tree": nginx falls through to the page store for every request."""
    current = Path(root) / 'current'
    previous = os.readlink(current) if current.is_symlink() else None
    if current.is_symlink(): current.unlink()
    return {'previous': previous}


# Renders are content-deterministic but not byte-deterministic: Next resolves metadata and
# client references concurrently, so about one page in five comes out with its <head> tags and
# flight rows in another order (measured 2026-11-21, docs/render-once.md §4). Compare modulo that.
_FLIGHT = re.compile(rb'<script>self\.__next_f\.push\(.*?\)</script>', re.S)
_HEAD = re.compile(rb'<head>(.*?)</head>', re.S)
_HEAD_TAG = re.compile(rb'<(title|script|style)\b[^>]*>.*?</\1>|<[a-z]+\b[^>]*>', re.S)
_FLIGHT_REF = re.compile(rb'\$[A-Za-z@]*[0-9a-f]+\b')


def normalized(kind, data):
    """HTML: flight scripts removed, <head> children sorted. RSC: rows without their ids,
    references masked, sorted. Equal values mean the same page content."""
    if kind == 'html':
        body = _FLIGHT.sub(b'', data)
        return _HEAD.sub(lambda m: b'<head>' + b''.join(sorted(t.group(0) for t in _HEAD_TAG.finditer(m.group(1)))) + b'</head>', body)
    return b'\n'.join(sorted(_FLIGHT_REF.sub(b'$R', line.split(b':', 1)[1]) for line in data.split(b'\n') if b':' in line))


def read_object(root, sha):
    return gzip.decompress(object_path(root, sha).read_bytes())


def same_page(kind, a, b):
    return a == b or normalized(kind, a) == normalized(kind, b)


def verify(root, tree_id, origin, *, sample=20, seed=0, get=http_get, timeout=180.0):
    """Render a sample on `origin` (the candidate or routed slot) and compare with the tree: an
    offline tree must show what the host renders for the same program and content."""
    manifest = read_tree(root, tree_id)
    paths = sorted(manifest['pages']); random.Random(seed).shuffle(paths)
    rows = []
    for path in paths[:sample]:
        result = capture_page(origin, path, get=get, timeout=timeout)
        if 'gap' in result: rows.append({'path': path, 'match': False, 'problem': result['gap']}); continue
        row = {'path': path}
        for kind in ('html', 'rsc'):
            sha = manifest['pages'][path][kind]
            row[kind] = 'bytes' if hashlib.sha256(result[kind]).hexdigest() == sha else 'normalized' if same_page(kind, result[kind], read_object(root, sha)) else 'different'
        row['match'] = 'different' not in (row['html'], row['rsc'])
        rows.append(row)
    return {'tree': tree_id, 'checked': len(rows), 'mismatches': [r for r in rows if not r['match']], 'rows': rows}


def diff_trees(a, b, root=None):
    """With `root`, pages whose bytes differ but whose normalized content is equal count as
    `orderOnly` (render-order noise), not as changed."""
    pa, pb = a['pages'], b['pages']
    same = [p for p in pa if p in pb and pa[p] == pb[p]]
    changed = sorted(p for p in pa if p in pb and pa[p] != pb[p])
    order_only = []
    if root:
        order_only = [p for p in changed if all(same_page(k, read_object(root, pa[p][k]), read_object(root, pb[p][k])) for k in ('html', 'rsc'))]
        changed = [p for p in changed if p not in order_only]
    return {'orderOnly': order_only, 'a': a['treeId'], 'b': b['treeId'], 'same': len(same), 'changed': changed, 'added': sorted(set(pb) - set(pa)), 'removed': sorted(set(pa) - set(pb)),
            'htmlOnlyChanged': sorted(p for p in changed if pa[p]['rsc'] == pb[p]['rsc']), 'rscOnlyChanged': sorted(p for p in changed if pa[p]['html'] == pb[p]['html'])}


# ---------------------------------------------------------------- CLI

def _write(receipt, value):
    if receipt: Path(receipt).write_text(json.dumps(value, indent=2) + '\n')


def main(argv=None, *, get=http_get):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest='command', required=True)
    for name in ('urls', 'refresh'):
        p = sub.add_parser(name)
        p.add_argument('--plan', action='append', default=[], help='switch-<time>.json or a JSON list / {"paths": [...]}; repeatable')
        p.add_argument('--path', action='append', default=[], help='refresh first (the readback set); repeatable')
        if name == 'refresh':
            p.add_argument('--origin', default='https://127.0.0.1', help='nginx on loopback (default https://127.0.0.1, SNI ' + SITE_HOST + ')')
            p.add_argument('--timeout', type=float, default=180.0)
            p.add_argument('--max-seconds', type=float, default=3600.0)
            p.add_argument('--receipt')
    p = sub.add_parser('generation'); p.add_argument('--content-id', required=True); p.add_argument('--file', default=str(GENERATION_FILE))
    p.add_argument('--log', default=str(GENERATION_LOG)); p.add_argument('--reason', default=''); p.add_argument('--dry-run', action='store_true')
    p = sub.add_parser('capture'); p.add_argument('--root', required=True); p.add_argument('--tree-id', required=True)
    p.add_argument('--origin', action='append', required=True, help='a loopback Next process; one worker per origin; repeatable')
    p.add_argument('--paths-file', action='append', default=[]); p.add_argument('--sitemap', action='store_true', help='add every sitemap <loc> of the first origin')
    p.add_argument('--base-tree'); p.add_argument('--content-id'); p.add_argument('--timeout', type=float, default=180.0)
    p.add_argument('--max-seconds', type=float, default=7200.0); p.add_argument('--receipt')
    for name in ('materialize', 'activate', 'verify'):
        p = sub.add_parser(name); p.add_argument('--root', required=True); p.add_argument('--tree-id', required=True)
        if name == 'activate': p.add_argument('--build-id')
        if name == 'verify':
            p.add_argument('--origin', required=True); p.add_argument('--sample', type=int, default=20); p.add_argument('--receipt')
    p = sub.add_parser('deactivate'); p.add_argument('--root', required=True)
    p = sub.add_parser('diff'); p.add_argument('a'); p.add_argument('b'); p.add_argument('--root', help='compare object content modulo render order')
    args = parser.parse_args(argv)

    if args.command in ('urls', 'refresh'):
        plan_paths = read_plan_paths(args.plan)
        paths = expand_paths(args.path, plan_paths, read_reading_changed(args.plan))
        probe = probe_paths(plan_paths + args.path, paths)
        if not paths: raise ValueError('No paths; pass --plan and/or --path')
        if args.command == 'urls':
            print(json.dumps({'paths': paths, 'count': len(paths), 'probe': probe, 'probeCount': len(probe)}, indent=1)); return 0
        parse_origin(args.origin)
        begun = datetime.datetime.now(datetime.timezone.utc).isoformat()
        rows = refresh(args.origin, paths, probe=probe, timeout=args.timeout, max_seconds=args.max_seconds, get=get)
        problems = refresh_problems(rows)
        receipt = {'schemaVersion': REFRESH_SCHEMA, 'startedAt': begun, 'finishedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   'origin': args.origin, 'plans': args.plan, 'requested': len(paths), 'probed': len(probe),
                   'probeRefreshed': sum(1 for r in rows if 'probe' in r and 'gzip' in r), 'problems': problems,
                   'slowest': sorted(({'path': r['path'], 'seconds': r['gzip']['seconds']} for r in rows if 'gzip' in r and r['gzip']['seconds']), key=lambda r: -r['seconds'])[:10], 'rows': rows}
        _write(args.receipt, receipt)
        print(json.dumps({k: receipt[k] for k in ('origin', 'requested', 'probed', 'probeRefreshed')} | {'problems': len(problems), 'firstProblems': problems[:5]}, indent=2))
        return 1 if problems else 0
    if args.command == 'generation':
        print(json.dumps(write_generation(args.content_id, file=args.file, log=args.log or None, reason=args.reason, dry_run=args.dry_run), indent=2)); return 0
    if args.command == 'capture':
        paths = [p for f in args.paths_file for p in read_plan_paths([f])]
        if args.sitemap: paths += sitemap_paths(args.origin[0], get=get, timeout=args.timeout)
        base = read_tree(args.root, args.base_tree) if args.base_tree else None
        manifest = capture(args.root, args.tree_id, args.origin, [_check_path(p) for p in paths], base=base, content_id=args.content_id, get=get, timeout=args.timeout, max_seconds=args.max_seconds)
        summary = {k: manifest[k] for k in ('treeId', 'buildId', 'contentId', 'baseTree', 'cacheControl', 'stats')} | {'pages': len(manifest['pages']), 'gaps': len(manifest['gaps']), 'notes': len(manifest['notes'])}
        _write(args.receipt, summary); print(json.dumps(summary, indent=2))
        return 1 if manifest['gaps'] else 0
    if args.command == 'materialize': print(json.dumps(materialize(args.root, args.tree_id), indent=2)); return 0
    if args.command == 'activate': print(json.dumps(activate(args.root, args.tree_id, build_id=args.build_id), indent=2)); return 0
    if args.command == 'deactivate': print(json.dumps(deactivate(args.root), indent=2)); return 0
    if args.command == 'verify':
        result = verify(args.root, args.tree_id, args.origin, sample=args.sample, get=get)
        _write(args.receipt, result); print(json.dumps({k: result[k] for k in ('tree', 'checked', 'mismatches')}, indent=2))
        return 1 if result['mismatches'] else 0
    if args.command == 'diff':
        result = diff_trees(json.loads(Path(args.a).read_text()), json.loads(Path(args.b).read_text()), root=args.root)
        print(json.dumps({k: (v if not isinstance(v, list) else {'count': len(v), 'first': v[:10]}) for k, v in result.items()}, indent=2)); return 0
    return 2


if __name__ == '__main__':
    try: sys.exit(main())
    except (ValueError, RuntimeError, OSError) as error:
        print('render-once error: ' + str(error), file=sys.stderr); sys.exit(2)
