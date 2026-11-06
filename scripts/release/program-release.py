#!/usr/bin/env python3
"""UAPT program release: the host-side steps of a program (code-only) release
as one command. Operator guide: docs/program-release.md, section 7.

Subcommands, in order. Each is idempotent and writes its receipts into one
operation directory (--op); `install` creates it.

  install    GitHub Actions artifact -> /srv/uapt/releases (program-artifact-install.py)
  candidate  free fixed web slot: drop-in, start, wait for the warm-up journal line
  static     union copy of .next/static into the shared static directory
  capacity   measured startup / cold / steady memory of the candidate
  routing    retarget the active web port to the candidate port; isolated nginx -t
  ledger     synchronization contract 2.1.0 event, candidate phase
  plan       retention receipt + lifecycle plan (static-only publicChecks); controller gate
  cutover    controller cutover
  complete   public readback, completion event, controller complete, register check
  status     print the operation state

The lifecycle controller (/usr/local/libexec/uapt-release-lifecycle.py) keeps
every gate: this command only prepares its inputs and calls it. It never builds,
never deletes a release, never writes nginx files itself (the controller does at
cutover), never purges a CDN and never sends search notifications.

Run on the host as root, e.g.
  GH_TOKEN=... program-release.py install --sha <40-hex> --run-id <id>
  program-release.py candidate --op <dir>     (then static, capacity, ...)
"""
import argparse, concurrent.futures, datetime, fcntl, grp, hashlib, importlib.util, json, os, re, shlex, shutil, subprocess, sys, tempfile, threading, time, urllib.error, urllib.request
from pathlib import Path

OPERATIONS = Path('/srv/uapt/operations')
RELEASES = Path('/srv/uapt/releases')
LIFECYCLE = OPERATIONS / 'release-lifecycle'
POLICY = LIFECYCLE / 'policy.json'
TRANSACTION = LIFECYCLE / 'transaction.json'
CONTROLLER = Path('/usr/local/libexec/uapt-release-lifecycle.py')
INSTALL_RECEIPTS = OPERATIONS / 'program-artifacts'
NGINX_ROOT = Path('/etc/nginx')
SYSTEMD_DIR = Path('/etc/systemd/system')
DEFAULT_REPO = 'SciWhite/university-ai-policy-tracker'
ORIGIN = 'https://eduaipolicy.org'
SITE_HOST = 'eduaipolicy.org'
# The two fixed web slots (docs/release-lifecycle.md). Override with --slot unit=port.
WEB_SLOTS = {'uapt-mcp-v6-candidate.service': 3101, 'uapt-mcp-v6-r2.service': 3102}
SERVICE_USER = 'uapt'
DROPIN_SUFFIX = '-uapt-program-release.conf'
CANDIDATE_MEMORY_HIGH = 3758096384
CANDIDATE_MEMORY_MAX = 4294967296
STATE_SCHEMA = 'uapt-program-release-operation-v1'
WARMUP_LINE = 'Runtime warm-up finished'
SHA40 = re.compile(r'^[0-9a-f]{40}$')
HEX64 = re.compile(r'^[0-9a-f]{64}$')
PLAN_ID = re.compile(r'^[a-z0-9][a-z0-9-]{0,79}$')
PROGRAM_PREFIX = 'uapt-program-'
CHANGE_SURFACES = ('history', 'universityChanges', 'latestDiff', 'changesIndex', 'recentChanges', 'rss')
SAMPLE_SIZE = 20
TIER_BANDS = ((1, 50), (51, 100), (101, 200), (201, 400), (401, None))
# Heavy routes first rendered after a restart (60-110 s cold on the loaded host).
HEAVY_PATHS = ['/sitemap.xml', '/sitemaps/zh.xml', '/sitemaps/changes.xml', '/sitemaps/universities.xml', '/sitemaps/core.xml',
               '/reports', '/zh/reports', '/feeds/atom.xml', '/feeds/recent-changes.xml', '/feeds/reports.xml', '/llms.txt',
               '/changes', '/zh/changes', '/', '/zh', '/universities', '/zh/universities']
CORE_PAGES = ['/', '/zh', '/changes', '/zh/changes', '/reports', '/universities', '/rankings', '/about']
CORE_RESOURCES = ['/llms.txt', '/sitemap.xml', '/feeds/recent-changes.xml', '/api/public/v1/changes/latest.json']


class Refused(Exception):
    pass


# ---------------------------------------------------------------- utilities

def now():
    return datetime.datetime.now(datetime.timezone.utc)


def iso(value=None):
    return (value or now()).isoformat()


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path):
    return json.loads(Path(path).read_text())


def write_json(path, value):
    """Atomic write (temp + rename), so hard-linked evidence is never modified in place."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.tmp')
    with tmp.open('w') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False)
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(tmp, path)
    return path


def ref(path, basis=None):
    value = {'path': str(path), 'sha256': sha256_file(path)}
    if basis:
        value['basisSha256'] = basis
    return value


def run(args, check=True, **kwargs):
    result = subprocess.run([str(a) for a in args], capture_output=True, text=True, **kwargs)
    if check and result.returncode != 0:
        raise Refused(f'{" ".join(map(str, args[:3]))} failed ({result.returncode}): {(result.stderr or result.stdout)[-2000:]}')
    return result


def log(message):
    print(f'[{now().strftime("%H:%M:%S")}] {message}', flush=True)


def link_or_copy(source, destination):
    """Evidence objects are immutable and content-addressed: hard-link when possible."""
    try:
        os.link(source, destination)
    except OSError:
        shutil.copy2(source, destination)
    return destination


# ---------------------------------------------------------------- pure parsing helpers

def parse_env(text):
    """systemd EnvironmentFile subset: KEY=VALUE, optional quotes, last assignment wins."""
    values = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        if line.startswith('export '):
            line = line[7:].lstrip()
        key, value = line.split('=', 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in '"\'':
            value = value[1:-1]
        values[key.strip()] = value
    return values


def parse_show(text):
    props = {}
    for line in text.splitlines():
        if '=' in line:
            key, value = line.split('=', 1)
            props.setdefault(key, []).append(value)
    return props


def show_value(props, key, default=''):
    values = props.get(key) or [default]
    return values[-1]


def exec_argv(value):
    match = re.search(r'argv\[\]=([^;]*)', value or '')
    return match.group(1).split() if match else []


def env_file_paths(values):
    return [re.sub(r'\s*\(ignore_errors=\w+\)\s*$', '', v).strip() for v in values or [] if v.strip()]


def unit_environment(values):
    env = {}
    for value in values or []:
        for item in shlex.split(value):
            if '=' in item:
                key, val = item.split('=', 1)
                env[key] = val
    return env


def release_root_name(working_directory, releases=RELEASES):
    try:
        parts = Path(working_directory).relative_to(releases).parts
    except ValueError:
        return None
    return parts[0] if parts else None


def plan_id_for(op_dir):
    value = re.sub(r'[^a-z0-9-]+', '-', Path(op_dir).name.lower()).strip('-')[:80].strip('-')
    if not PLAN_ID.match(value):
        raise Refused('Cannot derive a lifecycle transaction id from ' + str(op_dir))
    return value


def parse_slots(items):
    if not items:
        return dict(WEB_SLOTS)
    slots = {}
    for item in items:
        unit, _, port = item.partition('=')
        if not unit.endswith('.service') or not port.isdigit():
            raise Refused('--slot takes <unit>.service=<port>')
        slots[unit] = int(port)
    if len(slots) != 2 or len(set(slots.values())) != 2:
        raise Refused('Exactly two fixed web slots with distinct ports are required')
    return slots


def pick_slots(policy, running_units, slots):
    """The active web slot is the one the policy lists as active and that runs;
    the candidate is the other slot, which must be a registered candidate slot."""
    active = [u for u in slots if u in policy.get('activeUnits', []) and u in running_units]
    if len(active) != 1:
        raise Refused(f'Expected exactly one running active web slot among {sorted(slots)}; found {active}')
    free = [u for u in slots if u != active[0] and u in policy.get('candidateSlots', [])]
    if len(free) != 1:
        raise Refused(f'The other web slot is not a registered candidate slot: {sorted(set(slots) - set(active))}')
    return active[0], free[0]


# ---------------------------------------------------------------- systemd drop-in

def choose_dropin_name(existing_names):
    """Drop-ins apply in filename order across directories. Reuse our managed name
    when it already sorts last; otherwise take one more leading 'z' than any file."""
    names = sorted(Path(n).name for n in existing_names)
    ours = [n for n in names if n.endswith(DROPIN_SUFFIX)]
    if ours and names[-1] == ours[-1]:
        return ours[-1]
    longest = max([len(n) - len(n.lstrip('z')) for n in names] or [0])
    return 'z' * (longest + 1) + DROPIN_SUFFIX


def render_dropin(*, release, env_file, port, node_bin, memory_high=CANDIDATE_MEMORY_HIGH, memory_max=CANDIDATE_MEMORY_MAX, user=SERVICE_USER):
    web = Path(release) / 'apps/web'
    return '\n'.join([
        '# Managed by scripts/release/program-release.py; replaced on the next program release of this slot.',
        '[Service]',
        f'User={user}', f'Group={user}',
        f'WorkingDirectory={web}',
        'Environment=', 'EnvironmentFile=', 'PassEnvironment=', 'UnsetEnvironment=',
        f'EnvironmentFile={env_file}',
        f'Environment=PORT={port} HOSTNAME=127.0.0.1 NODE_ENV=production',
        'ExecStart=',
        f'ExecStart={node_bin} {web / "server.js"}',
        # Node exits 143 on SIGTERM; a stopped slot must end inactive, not failed.
        'SuccessExitStatus=143',
        'Restart=on-failure', 'RestartSec=5s', 'TimeoutStopSec=20s',
        'MemoryAccounting=yes', f'MemoryHigh={memory_high}', f'MemoryMax={memory_max}',
        'ReadWritePaths=',
        f'ReadWritePaths=/srv/uapt/mcp-telemetry {web / ".next/cache"}',
        '',
    ])


def check_runtime_env(env, content_root):
    problems = []
    if env.get('UAPT_CONTENT_ROOT') != str(content_root):
        problems.append(f'UAPT_CONTENT_ROOT is {env.get("UAPT_CONTENT_ROOT")!r}, expected {str(content_root)!r}')
    if env.get('UAPT_CONTENT_ALLOW_UNSYNCHRONIZED'):
        problems.append('UAPT_CONTENT_ALLOW_UNSYNCHRONIZED is set (local previews only)')
    # EnvironmentFile= overrides Environment=, so these would defeat the slot port.
    for key in ('PORT', 'HOSTNAME'):
        if key in env:
            problems.append(f'{key} must not be in the env file; the slot drop-in sets it')
    if not env.get('UAPT_CONTENT_REFRESH_TOKEN'):
        problems.append('UAPT_CONTENT_REFRESH_TOKEN is missing (runtime content readback needs it)')
    return problems


def warmup_finished(lines):
    for line in lines:
        if WARMUP_LINE in line:
            start = line.find('{')
            try:
                return json.loads(line[start:]) if start >= 0 else {'message': WARMUP_LINE}
            except ValueError:
                return {'message': WARMUP_LINE, 'raw': line[-500:]}
    return None


def latency_acceptable(rows, max_seconds):
    return bool(rows) and all(r['status'] == 200 and r['seconds'] <= max_seconds for r in rows)


# ---------------------------------------------------------------- routing

def port_pattern(port):
    return re.compile(r'127\.0\.0\.1:' + str(int(port)) + r'(?![0-9])')


def retarget(text, old_port, new_port, code_sha):
    out, count = port_pattern(old_port).subn(f'127.0.0.1:{int(new_port)}', text)
    if count:
        out = re.sub(r'(add_header X-UAPT-(?:V6|Main)-Code-Release ")[0-9a-f]{40}(")', lambda m: m.group(1) + code_sha + m.group(2), out)
    return out, count


def managed_snippets(nginx_root):
    return sorted(p for p in (Path(nginx_root) / 'snippets').glob('uapt-*.conf') if p.is_file() and not p.is_symlink())


def unmanaged_references(nginx_root, port):
    """Files nginx loads that the controller cannot switch (it only writes
    /etc/nginx/snippets/uapt-*): a reference there would keep the old port live."""
    root = Path(nginx_root)
    files = [root / 'nginx.conf'] + sorted((root / 'conf.d').glob('*.conf')) + sorted((root / 'sites-enabled').glob('*'))
    files += [p for p in sorted((root / 'snippets').glob('*.conf')) if not p.name.startswith('uapt-')]
    pattern = port_pattern(port)
    found = []
    for path in files:
        if path.is_file():
            try:
                text = path.read_text(errors='ignore')
            except OSError:
                continue
            if pattern.search(text):
                found.append(str(path))
    return found


def generate_routing(nginx_root, out_dir, old_port, new_port, code_sha, replacements=None):
    """Stage every managed snippet that routes to the old port, retargeted to the new
    one. `replacements` (snippet name -> file) stage reviewed new content for a snippet,
    e.g. a consolidated routing set; it is retargeted the same way and always staged."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    replacements = {Path(k).name: Path(v) for k, v in (replacements or {}).items()}
    managed = {p.name: p for p in managed_snippets(nginx_root)}
    unknown = sorted(set(replacements) - set(managed))
    if unknown:
        raise Refused('Replacements must name existing /etc/nginx/snippets/uapt-*.conf files: ' + ', '.join(unknown))
    files, total = [], 0
    for name, target in sorted(managed.items()):
        live_text = target.read_text()
        source_text = replacements[name].read_text() if name in replacements else live_text
        text, count = retarget(source_text, old_port, new_port, code_sha)
        if not count and name not in replacements:
            continue
        total += count
        staged = out_dir / target.name
        staged.write_text(text)
        files.append({'target': str(Path('/etc/nginx/snippets') / target.name) if Path(nginx_root) == NGINX_ROOT else str(target),
                      'beforeSha256': sha256_bytes(live_text.encode()), 'source': str(staged), 'sha256': sha256_file(staged),
                      **({'replacement': str(replacements[name]), 'replacementSha256': sha256_file(replacements[name])} if name in replacements else {})})
    left = [f['source'] for f in files if port_pattern(old_port).search(Path(f['source']).read_text())]
    return {'routingFiles': files, 'replacements': total, 'oldPort': int(old_port), 'newPort': int(new_port), 'oldPortLeftInStaged': left}


def isolated_nginx_test(nginx_root, routing_files, workdir, nginx_bin='nginx', retired_port=None):
    """Copy the nginx tree, place the staged snippets, rewrite absolute includes
    into the copy and run `nginx -T` (test + dump) on it. The controller's
    `complete` refuses while the retired endpoint appears in `nginx -T`, so the
    same check runs here, before cutover. The live configuration is not touched."""
    nginx_root = Path(nginx_root)
    scratch = Path(tempfile.mkdtemp(prefix='nginx-test-', dir=workdir))
    try:
        copy = scratch / 'etc-nginx'
        shutil.copytree(nginx_root, copy, symlinks=False, ignore=shutil.ignore_patterns('backups'), ignore_dangling_symlinks=True)
        for item in routing_files:
            shutil.copyfile(item['source'], copy / Path(item['target']).relative_to(nginx_root))
        prefix = str(nginx_root).rstrip('/') + '/'
        for path in copy.rglob('*'):
            if path.is_file():
                try:
                    text = path.read_text()
                except (UnicodeDecodeError, OSError):
                    continue
                if prefix in text:
                    path.write_text(text.replace(prefix, str(copy) + '/'))
        result = subprocess.run([nginx_bin, '-T', '-c', str(copy / 'nginx.conf'), '-p', str(copy) + '/'], capture_output=True, text=True)
        left = retired_port is not None and bool(port_pattern(retired_port).search(result.stdout))
        return {'ok': result.returncode == 0 and not left, 'retiredEndpointInConfig': left, 'output': (result.stdout[-1000:] + result.stderr)[-4000:]}
    finally:
        shutil.rmtree(scratch, ignore_errors=True)


# ---------------------------------------------------------------- sampling and readback evaluation

def qs_rank(summary):
    for alias in (summary.get('entity') or {}).get('aliases', []):
        match = re.match(r'^QS\s+\d{4}\s*=?\s*(\d+)\b', str(alias))
        if match:
            return int(match.group(1))
    return None


def _spread(items, count):
    """`count` items evenly spaced over an ordered list, ends included."""
    if count <= 0 or not items:
        return []
    if count >= len(items):
        return list(items)
    if count == 1:
        return [items[len(items) // 2]]
    return [items[round(i * (len(items) - 1) / (count - 1))] for i in range(count)]


def select_sample(summaries, changed_by_slug, size=SAMPLE_SIZE, required=()):
    """Deterministic sample: required slugs, structural extremes (most/fewest
    claims, latest-revision changes), then QS tiers filled evenly by rank."""
    by_slug = {s['entity']['slug']: s for s in summaries}
    order = [s['entity']['slug'] for s in summaries]
    reasons = {}

    def add(slug, reason, force=False):
        if slug in by_slug and (force or len(reasons) < size):
            reasons.setdefault(slug, []).append(reason)

    for slug in required:
        if slug not in by_slug:
            raise Refused('Sample slug is not in the synchronized scope: ' + slug)
        add(slug, 'required', force=True)
    if len(order) <= size:
        for slug in order:
            add(slug, 'whole scope')
        return [s for s in order if s in reasons], reasons
    claims = lambda slug: (len(by_slug[slug].get('claims', [])), slug)
    ranked = lambda slug: (qs_rank(by_slug[slug]) or 10 ** 6, slug)
    add(max(order, key=claims), 'most claims')
    add(min(order, key=claims), 'fewest claims')
    for slug in sorted((s for s in order if changed_by_slug.get(s)), key=ranked)[:2]:
        add(slug, 'changed in the latest projection revision')
    bands = []
    for low, high in TIER_BANDS:
        members = sorted((s for s in order if (qs_rank(by_slug[s]) or 0) >= low and (high is None or (qs_rank(by_slug[s]) or 0) <= high)), key=ranked)
        bands.append((f'QS {low}-{high}' if high else f'QS {low}+', members))
    bands.append(('unranked', sorted(s for s in order if qs_rank(by_slug[s]) is None)))
    bands = [(label, [s for s in members if s not in reasons]) for label, members in bands if members]
    remaining = size - len(reasons)
    quotas = {label: 0 for label, _ in bands}
    while remaining > 0 and any(quotas[label] < len(members) for label, members in bands):
        for label, members in bands:
            if remaining and quotas[label] < len(members):
                quotas[label] += 1
                remaining -= 1
    for label, members in bands:
        for slug in _spread(members, quotas[label]):
            add(slug, 'tier ' + label)
    return [s for s in order if s in reasons], reasons


def page_row(path, status, body, build_id, seconds, headers=None):
    text = body.decode('utf-8', 'ignore') if isinstance(body, bytes) else (body or '')
    lang = re.search(r'<html[^>]*\blang="([^"]+)"', text)
    canonical = re.search(r'rel="canonical" href="https://eduaipolicy\.org([^"]*)"', text)
    row = {'path': path, 'status': status, 'lang': lang.group(1) if lang else None,
           'canonical': canonical.group(1) if canonical else None, 'buildId': bool(build_id) and build_id in text,
           'seconds': round(seconds, 3), 'bytes': len(body or b'')}
    if headers and headers.get('cf-cache-status'):
        row['cfCacheStatus'] = headers['cf-cache-status']
    return row


def expected_lang(path):
    return 'zh' if path == '/zh' or path.startswith('/zh/') else 'en'


def school_page_problems(row):
    problems = []
    if row['status'] != 200:
        problems.append('status')
    if row['canonical'] != row['path']:
        problems.append('canonical')
    if row['lang'] != expected_lang(row['path']):
        problems.append('lang')
    if not row['buildId']:
        problems.append('BUILD_ID')
    return problems


def school_paths(slugs):
    return [p for s in slugs for p in (f'/universities/{s}', f'/zh/universities/{s}', f'/changes/{s}')]


# ---------------------------------------------------------------- HTTP

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def http_get(url, headers=None, timeout=120):
    request = urllib.request.Request(url, headers={'User-Agent': 'uapt-program-release/1.0', **(headers or {})})
    started = time.monotonic()
    try:
        with urllib.request.build_opener(_NoRedirect).open(request, timeout=timeout) as response:
            body = response.read()
            return response.status, body, {k.lower(): v for k, v in response.headers.items()}, time.monotonic() - started
    except urllib.error.HTTPError as error:
        body = error.read() if error.fp else b''
        return error.code, body, {k.lower(): v for k, v in (error.headers or {}).items()}, time.monotonic() - started
    except (urllib.error.URLError, OSError) as error:
        return 0, b'', {'error': str(error)}, time.monotonic() - started


def fetch(base, path, *, candidate, attempts=3, timeout=120, get=http_get):
    headers = {'Host': SITE_HOST, 'X-Forwarded-Proto': 'https'} if candidate else {}
    for attempt in range(attempts):
        status, body, response_headers, seconds = get(base + path, headers, timeout)
        if status and status < 500:
            break
        if attempt + 1 < attempts:
            time.sleep(3)
    return status, body, response_headers, seconds


def pool(items, worker, concurrency=2):
    with concurrent.futures.ThreadPoolExecutor(concurrency) as executor:
        return list(executor.map(worker, items))


def readback(base, slugs, build_id, *, candidate, get=http_get, query=''):
    """School pages (en, zh, /changes/<slug>), public API Claim IDs, core pages and
    resources, and the BUILD_ID static manifest. Concurrency 2, like every R1 readback."""
    suffix = ('?' + query) if query else ''

    def page(path):
        status, body, headers, seconds = fetch(base, path + suffix, candidate=candidate, get=get)
        return page_row(path, status, body, build_id, seconds, headers)

    def api(slug):
        status, body, _, _ = fetch(base, f'/api/public/v1/universities/{slug}.json', candidate=candidate, get=get)
        try:
            return slug, sorted(c['id'] for c in json.loads(body)['data']['claims']) if status == 200 else None
        except (ValueError, KeyError, TypeError):
            return slug, None

    def resource(path):
        status, body, headers, seconds = fetch(base, path, candidate=candidate, get=get)
        row = {'path': path, 'status': status, 'sha256': sha256_bytes(body or b''), 'seconds': round(seconds, 3)}
        if headers.get('cf-cache-status'):
            row['cfCacheStatus'] = headers['cf-cache-status']
        return row

    started = iso()
    pages = pool(school_paths(slugs), page)
    claims = dict(pool(slugs, api))
    core = pool(CORE_PAGES, page)
    resources = pool(CORE_RESOURCES + [f'/_next/static/{build_id}/_buildManifest.js'], resource)
    return {'startedAt': started, 'checkedAt': iso(), 'pages': pages, 'apiClaimIdsBySlug': claims, 'corePages': core, 'resources': resources}


def readback_problems(result, expected_claims, build_manifest_sha256):
    problems = []
    for row in result['pages']:
        issues = school_page_problems(row)
        if issues:
            problems.append({'path': row['path'], 'problems': issues, 'status': row['status']})
    for slug, ids in expected_claims.items():
        if result['apiClaimIdsBySlug'].get(slug) != sorted(ids):
            problems.append({'api': slug, 'problems': ['Claim IDs differ from the synchronized scope']})
    for row in result['corePages']:
        if row['status'] != 200 or not row['buildId']:
            problems.append({'path': row['path'], 'problems': ['status' if row['status'] != 200 else 'BUILD_ID'], 'status': row['status']})
    for row in result['resources']:
        if row['status'] != 200:
            problems.append({'path': row['path'], 'problems': ['status'], 'status': row['status']})
        elif row['path'].endswith('/_buildManifest.js') and row['sha256'] != build_manifest_sha256:
            problems.append({'path': row['path'], 'problems': ['BUILD_ID manifest bytes differ from the release']})
    return problems


# ---------------------------------------------------------------- synchronization ledger (contract 2.1.0)

def verify_content_event(event_path, pointer):
    """The content pointer's own synchronization event: exact hash, contract 2.1.0,
    basis = the selected content manifest, and every evidence file unchanged."""
    event_path = Path(event_path)
    sync = pointer.get('sync') or {}
    if sha256_file(event_path) != sync.get('eventSha256'):
        raise Refused(f'{event_path} is not the event the content pointer binds ({sync.get("eventSha256")})')
    event = read_json(event_path)
    if event.get('syncContractVersion') != '2.1.0' or sync.get('contractVersion') != '2.1.0':
        raise Refused('The content release must be synchronized under contract 2.1.0')
    if event.get('basisSha256') != pointer.get('manifestSha256'):
        raise Refused('The content sync event is bound to a different content manifest')
    root = event_path.parent
    pending = [event['basisArtifact'], event['scopeArtifact']] + [p for s in event['surfaces'].values() for p in s.get('evidence', [])]
    seen = set()
    while pending:
        proof = pending.pop()
        if proof['path'] in seen:
            continue
        seen.add(proof['path'])
        path = root / proof['path']
        if sha256_file(path) != proof['sha256']:
            raise Refused('Content sync evidence changed: ' + proof['path'])
        if path.suffix == '.json' and path.stat().st_size < (16 << 20):
            # Receipts reference their artifacts (data, projection, overviews, surfaces) by hash.
            stack = [read_json(path)]
            while stack:
                value = stack.pop()
                if isinstance(value, dict):
                    if isinstance(value.get('path'), str) and isinstance(value.get('sha256'), str) and HEX64.match(value['sha256']) and (root / value['path']).is_file():
                        pending.append(value)
                    stack.extend(value.values())
                elif isinstance(value, list):
                    stack.extend(value)
    for name in ('public_data', 'changes'):
        if event['surfaces'].get(name, {}).get('status') != 'updated':
            raise Refused('Content sync event lacks ' + name)
    return event


def find_content_event(pointer, operations=OPERATIONS):
    want = (pointer.get('sync') or {}).get('eventSha256')
    if not want:
        raise Refused('The content pointer has no synchronization receipt')
    for path in sorted(Path(operations).glob('*/sync/*/event.json')):
        if sha256_file(path) == want:
            return path
    raise Refused(f'No event.json under {operations}/*/sync/* has the pointer hash {want}; pass --content-event')


def _typed_receipt(event_dir, event, surface):
    for proof in event['surfaces'][surface].get('evidence', []):
        value = read_json(Path(event_dir) / proof['path'])
        if isinstance(value, dict) and value.get('surface') == surface:
            return value
    raise Refused('Content sync event has no typed receipt for ' + surface)


def event_slug_index(content_dir, changes_receipt):
    """Event id -> slug, from the frozen projection's event index."""
    projection = Path(content_dir) / changes_receipt['projectionArtifact']['path']
    manifest = read_json(projection)
    index_file = projection.parent / manifest['eventIndex']['file']
    if sha256_file(index_file) != manifest['eventIndex']['sha256']:
        raise Refused('Projection event index changed')
    return {row['id']: row['slug'] for row in read_json(index_file)}


def filter_event_ids(ids, slug_of, scope):
    """Projection surfaces are ordered global lists restricted to the release scope;
    restricting them further to a sub-scope is the same filter (see
    validate-change-event-projection.ts: latestDiff and the recent/RSS window
    are computed before the scope restriction)."""
    missing = [i for i in ids if i not in slug_of]
    if missing:
        raise Refused('Event ids missing from the projection index: ' + ', '.join(missing[:5]))
    scope = set(scope)
    return [i for i in ids if slug_of[i] in scope]


def build_program_event(*, content_dir, content_event, out_dir, basis_file, sample, sample_reasons, mode, mode_reason,
                        candidate_readback, mcp, runtime_state, event_id, content_manifest_sha256, generated_at=None):
    """Write a contract 2.1.0 `audit` event for the program basis, scoped to the
    sampled schools. Frozen policy artifacts (public data, Changes v2 projection,
    overviews) are taken from the content release's own synchronized event and
    restricted to the sample; HTTP and MCP observations are fresh."""
    content_dir, out = Path(content_dir), Path(out_dir)
    if out.exists():
        raise Refused(f'{out} exists; use --force to supersede it')
    content_scope = read_json(content_dir / content_event['scopeArtifact']['path'])
    claim_ids = {u['slug']: u['publicClaimIds'] for u in content_scope['universities']}
    scope_set = set(sample)
    if not sample or not scope_set <= set(claim_ids):
        raise Refused('Sample empty or outside the synchronized content scope')
    data_receipt = _typed_receipt(content_dir, content_event, 'public_data')
    changes_receipt = _typed_receipt(content_dir, content_event, 'changes')
    data_source = content_dir / data_receipt['dataArtifact']['path']
    if sha256_file(data_source) != data_receipt['dataArtifact']['sha256']:
        raise Refused('Content public data artifact changed')
    summaries = [s for s in read_json(data_source) if s['entity']['slug'] in scope_set]
    for slug in sample:
        if sorted(candidate_readback['apiClaimIdsBySlug'].get(slug) or []) != sorted(claim_ids[slug]):
            raise Refused('Candidate API Claim IDs differ from the synchronized scope: ' + slug)
        if sorted(mcp['claimIdsBySlug'].get(slug) or []) != sorted(claim_ids[slug]):
            raise Refused('MCP Claim IDs differ from the synchronized scope: ' + slug)
    if runtime_state.get('manifestSha256') != content_manifest_sha256:
        raise Refused('Candidate runtime serves a different content manifest')

    out.mkdir(parents=True)
    checked = generated_at or iso()
    shutil.copyfile(basis_file, out / 'basis.json')
    basis = sha256_file(out / 'basis.json')
    proof = lambda path: {'path': str(Path(path).relative_to(out)), 'sha256': sha256_file(path), 'basisSha256': basis}

    scope = {
        'schemaVersion': 'uapt-policy-sync-scope-v1',
        'universities': [{'slug': u['slug'], 'publicClaimIds': u['publicClaimIds']} for u in content_scope['universities'] if u['slug'] in scope_set],
        'changedRevisionsBySlug': {s: content_scope['changedRevisionsBySlug'][s] for s in content_scope['changedRevisionsBySlug'] if s in scope_set},
        'policyScopeMeaning': (
            'Program-only release audit. The content pointer is unchanged and was synchronized by its own contract 2.1.0 '
            f'event {content_event["eventId"]}, which covers all {len(claim_ids)} schools. This event binds the program basis and '
            f'audits the candidate program serving that content for the {len(sample)} schools listed here ({mode} readback: '
            f'{mode_reason}). No policy revision, Claim ID, held decision or quote changes; frozen artifacts below are the '
            'content event\'s, restricted to these schools.'),
        'contentSync': {'eventId': content_event['eventId'], 'eventSha256': sha256_file(content_dir / 'event.json'),
                        'eventPath': str(content_dir / 'event.json'), 'contractVersion': content_event['syncContractVersion'],
                        'contentManifestSha256': content_manifest_sha256, 'universities': len(claim_ids)},
        'sample': {'mode': mode, 'reason': mode_reason, 'size': len(sample), 'reasons': {s: sample_reasons.get(s, []) for s in sample}},
    }
    scope_path = write_json(out / 'scope.json', scope)
    data_path = write_json(out / 'public-data.json', summaries)
    data_hash = sha256_file(data_path)
    shutil.copytree(content_dir / 'proof', out / 'proof', copy_function=link_or_copy)
    overview_path = out / 'overviews.json'
    link_or_copy(content_dir / changes_receipt['overviewArtifact']['path'], overview_path)
    readback_path = write_json(out / 'candidate-readback.json', candidate_readback)
    rb = proof(readback_path)

    slug_of = event_slug_index(content_dir, changes_receipt)
    event_surfaces = {}
    for name in CHANGE_SURFACES:
        source = read_json(content_dir / changes_receipt['eventSurfaces'][name]['path'])
        surface = {'schemaVersion': 'uapt-change-event-surface-v1', 'surface': name, 'checkedSlugs': sample,
                   'projectionSha256': source['projectionSha256'], 'rulesVersion': source['rulesVersion'],
                   'eventIds': filter_event_ids(source['eventIds'], slug_of, scope_set),
                   'observationMode': 'Deterministic projection of the synchronized content event restricted to this scope; '
                                      'candidate /changes/<slug> and /changes returned 200 (candidate-readback.json).'}
        if 'window' in source:
            surface['window'] = source['window']
        event_surfaces[name] = proof(write_json(out / f'{name}-events.json', surface))

    def receipt(surface, body):
        return write_json(out / f'{surface}-surface.json', {'schemaVersion': 'uapt-policy-surface-receipt-v1', 'surface': surface,
                                                            'basisSha256': basis, 'checkedAt': checked, 'checkedSlugs': sample, **body})

    api_claims = candidate_readback['apiClaimIdsBySlug']
    changes_path = receipt('changes', {
        'checks': {k: True for k in ('universityChanges', 'history', 'latestDiff', 'changesIndex', 'recentChanges', 'rss')},
        'projectionArtifact': proof(out / changes_receipt['projectionArtifact']['path']), 'overviewArtifact': proof(overview_path),
        'inputBasisSha256': changes_receipt['inputBasisSha256'], 'projectionRevision': changes_receipt['projectionRevision'],
        'rulesVersion': changes_receipt['rulesVersion'], 'eventSurfaces': event_surfaces, 'readback': rb})
    surfaces = {
        'public_data': {'status': 'updated', 'evidence': [proof(receipt('public_data', {
            'checks': {'schemaValidated': True, 'privateFieldsExcluded': True, 'recordCountsValidated': True, 'claimFingerprintsValidated': True},
            'dataArtifact': proof(data_path), 'observedClaimIdsBySlug': {s: api_claims[s] for s in sample},
            'validationMode': f'Summaries are the byte-verified public data of content sync event {content_event["eventId"]} (validated by '
                              'content:validate at the content release), restricted to this scope; candidate public API Claim IDs equal them.',
            'readback': rb}))]},
        'changes': {'status': 'updated', 'evidence': [proof(changes_path)]},
        'mcp': {'status': 'updated', 'evidence': [proof(receipt('mcp', {
            'checks': {'remainingClaimIdsEmpty': True, 'publishedOnly': True, 'scopePreserved': True},
            'observedClaimIdsBySlug': mcp['claimIdsBySlug'], 'remainingClaimIds': [], 'dataBasisSha256': data_hash,
            'observationMode': f'Live MCP {mcp["endpoint"]} catalog (healthz release {mcp["health"].get("releaseId")} and catalog file hash '
                               'in candidate-readback.json). Claim ID sets equal the published scope exactly, so no held Claim ID is exposed. '
                               'MCP is unchanged by a program release.',
            'readback': rb}))]},
        'pages': {'status': 'updated', 'evidence': [proof(receipt('pages', {
            'checks': {'affectedLocalesReadBack': True, 'unchangedControlsReadBack': True},
            'observationMode': 'en and zh university pages and /changes/<slug> for every school in scope on the candidate (status, lang, self '
                               'canonical, BUILD_ID), plus core pages and resources as unchanged controls.',
            'readback': rb}))]},
        'runtime_content': {'status': 'updated', 'evidence': [proof(receipt('runtime_content', {
            'checks': {'contentHashMatched': True, 'dataCompatibilityValidated': True, 'affectedRoutesReadBack': True},
            'expectedContentHash': content_manifest_sha256, 'observedContentHash': runtime_state['manifestSha256'],
            'expectedDataHash': data_hash, 'observedDataHash': data_hash, 'dataBasisSha256': data_hash, 'readback': rb}))]},
        'candidate_readback': {'status': 'updated', 'evidence': [proof(receipt('candidate_readback', {
            'checks': {'affectedRoutesReadBack': True, 'artifactIdentityMatched': True},
            'buildId': candidate_readback['buildId'], 'readback': rb}))]},
    }
    exclusions = {
        'inventory': 'Program-only release: no evidence crawl or private policy-inventory mutation.',
        'knowledge': 'Program-only release: no knowledge ingestion or policy research.',
        'review_cache': 'Program-only release: no review approval, held decision or review-cache promotion.',
        'tools': 'Tool records come unchanged from the synchronized content release.',
        'student_snapshot': 'No snapshot repin or approval change.',
        'search_coverage': 'Search routing and identities unchanged; core pages read back on the candidate.',
        'sitemap': 'Sitemaps are rendered from the unchanged content release; /sitemap.xml read back on the candidate.',
    }
    for name, reason in exclusions.items():
        surfaces[name] = {'status': 'not_required_with_reason', 'reason': reason}
    surfaces['notifications'] = {'status': 'deferred_until_cutover', 'reason': 'Search notifications only after public readback and a separate authorization.'}
    surfaces['public_readback'] = {'status': 'deferred_until_cutover', 'reason': 'Public readback happens after the authorized cutover; the completion event attaches it.'}
    event = {'schemaVersion': 'uapt-policy-sync-event-v2', 'eventId': event_id, 'eventType': 'audit', 'syncContractVersion': '2.1.0',
             'requirementsVersion': '1.1.0', 'generatedAt': checked, 'phase': 'candidate_actual_acceptance',
             'candidateAcceptance': 'ACTUAL_HTTP_BOUND', 'publicAcceptance': 'NOT_RUN', 'basisSha256': basis,
             'basisArtifact': proof(out / 'basis.json'), 'scopeArtifact': proof(scope_path), 'surfaces': surfaces}
    return write_json(out / 'event.json', event)


def build_completion_event(*, candidate_dir, out_dir, public_readback, origin=ORIGIN, checked_at=None):
    candidate_dir, out = Path(candidate_dir), Path(out_dir)
    if out.exists():
        raise Refused(f'{out} exists; use --force to supersede it')
    shutil.copytree(candidate_dir, out, copy_function=link_or_copy)
    event = read_json(out / 'event.json')
    basis = event['basisSha256']
    scope = read_json(out / 'scope.json')
    checked = checked_at or iso()
    rb = write_json(out / 'public-readback.json', {'schemaVersion': 'uapt-program-public-readback-v1', 'origin': origin, **public_readback})
    receipt = write_json(out / 'public_readback-surface.json', {
        'schemaVersion': 'uapt-policy-surface-receipt-v1', 'surface': 'public_readback', 'basisSha256': basis, 'checkedAt': checked,
        'checkedSlugs': [u['slug'] for u in scope['universities']], 'checks': {'affectedRoutesReadBack': True, 'artifactIdentityMatched': True},
        'readback': {'path': rb.name, 'sha256': sha256_file(rb), 'basisSha256': basis},
        'observationMode': f'Real {origin} after the authorized cutover: en and zh university pages and /changes/<slug> for every school in '
                           'scope (status, lang, self canonical, BUILD_ID in HTML), public API Claim IDs equal to scope, core pages, '
                           'resources and the BUILD_ID static manifest.'})
    surfaces = event['surfaces']
    surfaces['public_readback'] = {'status': 'updated', 'evidence': [{'path': receipt.name, 'sha256': sha256_file(receipt), 'basisSha256': basis}]}
    surfaces['notifications'] = {'status': 'not_required_with_reason', 'reason': 'No IndexNow or other search notification is authorized by this release; indexing is not assumed.'}
    event.update({'eventId': re.sub(r'-candidate$', '', event['eventId']) + '-complete', 'phase': 'complete_actual_public_readback',
                  'publicAcceptance': 'ACTUAL_PUBLIC_HTTP_BOUND', 'generatedAt': checked})
    return write_json(out / 'event.json', event)


# ---------------------------------------------------------------- capacity

def capacity_receipt(*, samples, request_rows, code_sha, build_id, basis_sha, unit, pid, invocation, startup_seconds=60, note=None):
    """samples: [(seconds since candidate start, stage, bytes)] where stage is
    'warmup' (candidate step), 'cold_history' or 'steady' (capacity step)."""
    def peak(rows):
        return max([b for _, _, b in rows] or [0])
    startup = peak([r for r in samples if r[1] == 'warmup' and r[0] <= startup_seconds]) or peak([r for r in samples if r[1] == 'cold_history'][:10])
    cold = max(peak([r for r in samples if r[1] == 'warmup' and r[0] > startup_seconds]), peak([r for r in samples if r[1] == 'cold_history']))
    steady = peak([r for r in samples if r[1] == 'steady'])
    return {'schemaVersion': 'uapt-measured-release-capacity-v1', 'status': 'MEASURED', 'checkedAt': iso(), 'codeSha': code_sha,
            'BUILD_ID': build_id, 'basisSha256': basis_sha,
            'peakBytesByStage': {'build': startup, 'startup': startup, 'cold_history': cold, 'steady': steady},
            'buildStageNote': note or ('No server build: the program was built off-host in GitHub Actions. On-host work is the installer\'s '
                                       'tarball extraction; the build value is the measured startup peak as an upper bound.'),
            'mainPids': {unit: int(pid)}, 'invocationIds': {unit: invocation}, 'sampleCount': len(samples),
            'sampling': 'systemd MemoryCurrent: every 5 s from candidate start through warm-up, then every 1 s during the cold request pass and 60 s steady',
            'coldRequests': len(request_rows), 'coldNon200': [r for r in request_rows if r[1] != 200][:20]}


# ---------------------------------------------------------------- retention receipt and plan

def build_retention_receipt(register, observed_roots, observed_temps, new_entry, basis_sha, at=None):
    by_name = {e['name']: e for e in register.get('entries', [])}
    missing = sorted(set(observed_roots) - set(by_name) - {new_entry['name']})
    if missing:
        raise Refused('Release roots missing from the retention register; classify them first: ' + ', '.join(missing))
    entries = []
    for name in sorted(observed_roots):
        entry = dict(by_name.get(name, {}))
        if name == new_entry['name']:
            entry.update(new_entry)
            entry.setdefault('registeredAt', iso(at))
        entries.append(entry)
    temps = [t for t in register.get('temporaryArtifacts', []) if t['path'] in set(observed_temps)]
    unclassified = sorted(set(observed_temps) - {t['path'] for t in temps})
    if unclassified:
        raise Refused('Temporary artifacts missing from the retention register: ' + ', '.join(unclassified))
    receipt = {k: v for k, v in register.items() if k not in ('entries', 'temporaryArtifacts')}
    receipt.update({'schemaVersion': 'uapt-release-retention-v1', 'basisSha256': basis_sha, 'checkedAt': iso(at),
                    'entries': entries, 'temporaryArtifacts': temps})
    return receipt


def next_plan_id(base, transactions_dir):
    """The controller creates transactions/<id> once (exist_ok=False), even for a
    cutover that then fails and recovers. Each plan attempt gets an unused id."""
    base = base[:76].rstrip('-')
    for attempt in range(1, 100):
        candidate = base if attempt == 1 else f'{base}-p{attempt}'
        if not (Path(transactions_dir) / candidate).exists():
            return candidate
    raise Refused('No free transaction id for ' + base)


def plan_expiry(at, plan_hours, ttl_hours, candidate_started):
    """Bounded by the plan window and by the candidate's own lifetime since it started."""
    expires = min(at + datetime.timedelta(hours=min(plan_hours, ttl_hours)), candidate_started + datetime.timedelta(hours=ttl_hours)) - datetime.timedelta(minutes=5)
    if expires <= at + datetime.timedelta(minutes=15):
        raise Refused(f'The candidate started {candidate_started.isoformat()} and reaches its {ttl_hours} h lifetime; restart it with candidate')
    return expires


def peak_budgets(measured, previous, policy, candidate_override=None, build_override=None):
    """At least the measured peaks (the gate refuses understated budgets), at least the
    previous plan's, never above the policy limits."""
    runtime = max(v for k, v in measured.items() if k != 'build')
    candidate_cap = policy['candidatePeakMaxBytes']
    build_cap = policy.get('buildPeakMaxBytes', candidate_cap)
    candidate = candidate_override or min(candidate_cap, max(runtime, previous.get('candidatePeakBytes') or 0))
    build = build_override or min(build_cap, max(measured['build'], previous.get('buildPeakBytes') or 0))
    if candidate < runtime or build < measured['build'] or candidate > candidate_cap or build > build_cap:
        raise Refused(f'Peak budgets {candidate}/{build} do not cover measured {measured} within policy limits')
    return candidate, build


def build_plan(*, plan_id, expires_at, policy_sha, basis, sync_ledger, retention, static_receipt, capacity, runtime_env, helper,
               routing_files, build_id, build_manifest_sha256, candidate_unit, candidate_port, active_unit, active_port,
               keep_active, disk_budget, candidate_peak, build_peak, purpose, origin=ORIGIN):
    """Lifecycle plan (uapt-release-lifecycle-plan-v1). publicChecks are static
    only: they prove the new BUILD_ID assets are publicly served from the shared
    static alias (not that routing switched, since that alias is shared). The
    switch is proven by the completion ledger's public readback (BUILD_ID in every
    page's HTML) and the controller's `nginx -T` check at complete; cold renders
    are kept out of the cutover window."""
    return {
        'schemaVersion': 'uapt-release-lifecycle-plan-v1', 'id': plan_id, 'expiresAt': expires_at, 'policySha256': policy_sha,
        'basis': basis, 'syncLedger': sync_ledger, 'retentionReceipt': retention, 'staticArchiveReceipt': static_receipt,
        'capacityReceipt': capacity, 'runtimeEnv': runtime_env, 'releaseHelper': helper['path'], 'releaseHelperSha256': helper['sha256'],
        'routingFiles': routing_files,
        'candidateChecks': [{'url': f'http://127.0.0.1:{candidate_port}/_next/static/{build_id}/_buildManifest.js', 'sha256': build_manifest_sha256}],
        'publicChecks': [{'url': f'{origin}/_next/static/{build_id}/_buildManifest.js?uapt_release={plan_id}', 'sha256': build_manifest_sha256}],
        'candidateUnits': [candidate_unit], 'candidateEndpoints': {candidate_unit: [f'127.0.0.1:{candidate_port}']},
        'keepActiveUnits': keep_active, 'retireUnits': [active_unit], 'retiredEndpoints': [f'127.0.0.1:{active_port}'],
        'diskBudget': {**disk_budget, 'basisSha256': basis['sha256']}, 'candidatePeakBytes': candidate_peak, 'buildPeakBytes': build_peak,
        'admissionPurpose': purpose,
    }


# ---------------------------------------------------------------- host context

def load_controller(path=CONTROLLER):
    spec = importlib.util.spec_from_file_location('uapt_lifecycle', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def unit_props(unit, *props):
    return parse_show(run(['systemctl', 'show', unit, '-p', ','.join(props)]).stdout)


def running_units():
    out = run(['systemctl', 'list-units', '--type=service', '--state=running', 'uapt*', '--no-legend', '--no-pager', '--plain']).stdout
    return [line.split()[0] for line in out.splitlines() if line.split()]


def unit_env(unit):
    props = unit_props(unit, 'Environment', 'EnvironmentFiles')
    env = unit_environment(props.get('Environment'))
    for path in env_file_paths(props.get('EnvironmentFiles')):
        env.update(parse_env(Path(path).read_text()))
    return env


def previous_plan():
    if not TRANSACTION.is_file():
        return None
    tx = read_json(TRANSACTION)
    return tx['plan'] if tx.get('stage') == 'complete' else None


def discover(args):
    """Defaults from the server's actual state: policy, running slots, the active
    web unit's env/node, MCP unit and catalog, previous completed plan."""
    policy = read_json(POLICY)
    slots = parse_slots(args.slot)
    running = running_units()
    active, candidate = pick_slots(policy, running, slots)
    props = unit_props(active, 'ExecStart', 'EnvironmentFiles', 'WorkingDirectory')
    env_files = env_file_paths(props.get('EnvironmentFiles'))
    if len(env_files) != 1:
        raise Refused(f'{active} must use exactly one EnvironmentFile; pass --env')
    env_source = Path(getattr(args, 'env', None) or env_files[0])
    env = parse_env(env_source.read_text())
    if not env.get('UAPT_CONTENT_ROOT'):
        raise Refused(f'{env_source} does not set UAPT_CONTENT_ROOT; the runtime env file must select the content root')
    mcp_units = [u for u in policy['activeUnits'] if u not in slots]
    mcp_env = unit_env(mcp_units[0]) if len(mcp_units) == 1 else {}
    mcp_port = mcp_env.get('UAPT_MCP_PORT') or mcp_env.get('PORT')
    previous = previous_plan()
    return {
        'policy': policy, 'slots': slots, 'activeUnit': active, 'activePort': slots[active], 'candidateUnit': candidate,
        'candidatePort': slots[candidate], 'nodeBin': getattr(args, 'node_bin', None) or (exec_argv(show_value(props, 'ExecStart')) or ['node'])[0],
        'envSource': str(env_source), 'contentRoot': env.get('UAPT_CONTENT_ROOT'),
        'mcp': {'unit': mcp_units[0] if len(mcp_units) == 1 else None,
                'endpoint': getattr(args, 'mcp_endpoint', None) or (f'127.0.0.1:{mcp_port}' if mcp_port else None),
                'catalog': getattr(args, 'mcp_catalog', None) or mcp_env.get('UAPT_MCP_CATALOG')},
        'keepActive': [u for u in policy['activeUnits'] if u != active],
        'previousPlan': previous,
    }


# ---------------------------------------------------------------- operation state

class Operation:
    def __init__(self, op_dir):
        self.dir = Path(op_dir).resolve()
        self.state_path = self.dir / 'release.json'

    def lock(self):
        self.dir.mkdir(parents=True, exist_ok=True)
        self._lock = (self.dir / '.lock').open('w')
        try:
            fcntl.flock(self._lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise Refused('Another program-release command is running on ' + str(self.dir))

    def load(self):
        if not self.state_path.is_file():
            raise Refused(f'No operation state in {self.dir}; run install first')
        self.state = read_json(self.state_path)
        if self.state.get('schemaVersion') != STATE_SCHEMA:
            raise Refused('Unknown operation state schema')
        return self.state

    def save(self):
        write_json(self.state_path, self.state)

    def done(self, step, **data):
        self.state.setdefault('steps', {})[step] = {'at': iso(), **data}
        self.save()

    def require(self, *steps):
        missing = [s for s in steps if s not in self.state.get('steps', {})]
        if missing:
            raise Refused('Run first: ' + ', '.join(missing))

    def path(self, *parts):
        return self.dir.joinpath(*parts)


def content_pointer(root):
    return read_json(Path(root) / 'current.json')


def require_unchanged_content(state):
    pointer = content_pointer(state['content']['root'])
    if pointer.get('contentId') != state['content']['contentId'] or pointer.get('manifestSha256') != state['content']['manifestSha256']:
        raise Refused('The content pointer changed since install; start a new operation for the new content basis')
    return pointer


def candidate_identity(unit):
    props = unit_props(unit, 'ActiveState', 'MainPID', 'InvocationID', 'WorkingDirectory', 'MemoryCurrent')
    return {k: show_value(props, k) for k in ('ActiveState', 'MainPID', 'InvocationID', 'WorkingDirectory', 'MemoryCurrent')}


def require_candidate_running(state):
    info = state['steps']['candidate']
    now_id = candidate_identity(state['candidateUnit'])
    if now_id['ActiveState'] != 'active' or now_id['InvocationID'] != info['invocationId']:
        raise Refused(f'{state["candidateUnit"]} is not the started candidate any more ({now_id["ActiveState"]}, {now_id["InvocationID"]}); rerun candidate')
    return now_id


# ---------------------------------------------------------------- subcommands

def cmd_install(args):
    if not SHA40.match(args.sha):
        raise Refused('--sha must be the full 40-character commit SHA')
    ctx = discover(args)
    op_dir = Path(args.op) if args.op else unfinished_operation(args.sha) or OPERATIONS / f'program-{args.sha[:12]}-{now().strftime("%Y%m%dt%H%Mz")}'
    op = Operation(op_dir)
    op.lock()
    if op.state_path.is_file():
        op.load()
        if op.state['codeSha'] != args.sha:
            raise Refused(f'{op.dir} belongs to {op.state["codeSha"]}')
        log(f'install already recorded: {op.state["release"]}')
        return op
    pointer = content_pointer(ctx['contentRoot'])
    if pointer.get('unsynchronizedLocalPreview') or not (pointer.get('sync') or {}).get('eventSha256'):
        raise Refused('The content pointer has no synchronization receipt; run the content release flow first')

    receipt_path = None
    if args.existing_release:
        release = Path(args.existing_release).resolve()
        built = read_json(release / 'build-artifact-manifest.json')
        if built.get('codeSha') != args.sha:
            raise Refused('Existing release was built from ' + str(built.get('codeSha')))
        basis = {'schemaVersion': 'uapt-program-release-basis-v1', 'release': str(release), 'codeSha': args.sha, 'BUILD_ID': built['BUILD_ID'],
                 'sourceManifestSha256': sha256_file(release / 'source-manifest.json'),
                 'buildArtifactSha256': sha256_file(release / 'build-artifact-manifest.json')}
        artifact = {'existingRelease': str(release), 'note': 'Re-release of an installed root (rollback); nothing downloaded.'}
    else:
        existing = [p for p in sorted(INSTALL_RECEIPTS.glob(f'{PROGRAM_PREFIX}{args.sha[:12]}-*.json')) if read_json(p).get('codeSha') == args.sha]
        if existing:
            receipt_path = existing[-1]
            log(f'reusing install receipt {receipt_path}')
        else:
            if not (args.run_id or args.zip):
                raise Refused('Pass --run-id (with GH_TOKEN) or --zip, or --existing-release for a rollback')
            installer = Path(args.installer)
            command = [sys.executable, installer, '--sha', args.sha, '--node-bin', ctx['nodeBin'], '--production-env', args.production_env or ctx['envSource']]
            command += ['--run-id', args.run_id, '--repo', args.repo] if args.run_id else ['--zip', args.zip]
            log('installing artifact (program-artifact-install.py)')
            started = time.monotonic()
            result = run(command, check=False)
            (op.dir / 'install.log').write_text(result.stdout + result.stderr)
            if result.returncode != 0:
                raise Refused('Installer refused: ' + (result.stderr or result.stdout)[-1500:])
            receipt_path = Path(json.loads(result.stdout)['receipt']['path'])
            log(f'installed in {time.monotonic() - started:.0f} s')
        receipt = read_json(receipt_path)
        basis = dict(receipt['basis'])
        release = Path(basis['release'])
        artifact = {'repository': args.repo, **receipt.get('source', {}), 'installReceipt': str(receipt_path)}
    basis['contentRelease'] = {'root': ctx['contentRoot'], 'contentId': pointer['contentId'], 'manifestSha256': pointer['manifestSha256']}
    basis['programArtifact'] = artifact
    basis_path = write_json(op.dir / 'program-basis.json', basis)
    op.state = {
        'schemaVersion': STATE_SCHEMA, 'createdAt': iso(), 'planId': plan_id_for(op.dir), 'codeSha': args.sha, 'BUILD_ID': basis['BUILD_ID'],
        'release': str(release), 'basis': ref(basis_path), 'installReceipt': str(receipt_path) if receipt_path else None,
        'content': {'root': ctx['contentRoot'], 'contentId': pointer['contentId'], 'manifestSha256': pointer['manifestSha256'], 'sync': pointer.get('sync')},
        'slots': ctx['slots'], 'activeUnit': ctx['activeUnit'], 'activePort': ctx['activePort'],
        'candidateUnit': ctx['candidateUnit'], 'candidatePort': ctx['candidatePort'], 'nodeBin': ctx['nodeBin'],
        'envSource': ctx['envSource'], 'mcp': ctx['mcp'], 'keepActive': ctx['keepActive'], 'steps': {},
    }
    if args.helper:
        op.state['releaseHelper'] = str(Path(args.helper).resolve())
    op.state['sample'] = choose_sample(op.state, readback=args.readback, size=args.sample_size, extra=args.sample_slug or (), content_event=args.content_event)
    log(f'readback scope: {op.state["sample"]["mode"]}, {len(op.state["sample"]["slugs"])} schools ({op.state["sample"]["reason"]})')
    op.done('install', release=str(release), BUILD_ID=basis['BUILD_ID'])
    log(f'operation {op.dir} (plan id {op.state["planId"]}); next: candidate --op {op.dir}')
    return op


def unfinished_operation(sha, operations=OPERATIONS):
    """A rerun of install without --op continues the latest unfinished operation for the SHA."""
    for path in sorted(Path(operations).glob(f'program-{sha[:12]}-*/release.json'), reverse=True):
        state = read_json(path)
        if state.get('codeSha') == sha and 'complete' not in state.get('steps', {}):
            return path.parent
    return None


def open_op(args, *required):
    op = Operation(args.op)
    op.lock()
    op.load()
    op.require(*required)
    return op


def install_runtime_env(op, source):
    """Copy of the active slot's env, root:uapt 0640. It holds secrets: never printed."""
    target = op.path('runtime.env')
    if not target.exists():
        shutil.copyfile(source, target)
        os.chown(target, 0, grp.getgrnam(SERVICE_USER).gr_gid)
        os.chmod(target, 0o640)
    problems = check_runtime_env(parse_env(target.read_text()), op.state['content']['root'])
    if problems:
        raise Refused('Runtime env refused (' + str(target) + '): ' + '; '.join(problems))
    return target


def probe_latency(port, slugs, build_id):
    paths = ['/', '/changes', '/reports', '/sitemap.xml'] + [f'/universities/{s}' for s in slugs[:4]]
    rows = []
    for path in paths:
        status, body, headers, seconds = fetch(f'http://127.0.0.1:{port}', path, candidate=True, attempts=1, timeout=30)
        rows.append({'path': path, 'status': status, 'seconds': round(seconds, 3)})
    return rows


def refuse_after_cutover(state, step):
    tx = transaction()
    if 'cutover' in state['steps'] or (tx.get('plan', {}).get('id') in state.get('planIds', []) and tx.get('stage') in ('prepared', 'selected_pending_acceptance', 'complete')):
        raise Refused(f'{step} refused: this operation is cut over; the candidate slot now serves public traffic')


def cmd_candidate(args):
    op = open_op(args, 'install')
    state = op.state
    refuse_after_cutover(state, 'candidate')
    require_unchanged_content(state)
    unit, port, release = state['candidateUnit'], state['candidatePort'], Path(state['release'])
    policy = read_json(POLICY)
    if unit in policy['activeUnits'] or unit not in policy['candidateSlots']:
        raise Refused(f'{unit} is no longer a free candidate slot')
    env_file = install_runtime_env(op, args.env or state['envSource'])
    cache = release / 'apps/web/.next/cache'
    cache.mkdir(exist_ok=True)
    shutil.chown(cache, SERVICE_USER, SERVICE_USER)

    dropin_dir = SYSTEMD_DIR / f'{unit}.d'
    existing = unit_props(unit, 'DropInPaths')
    names = [Path(p).name for v in existing.get('DropInPaths', []) for p in v.split()]
    name = choose_dropin_name(names)
    text = render_dropin(release=release, env_file=env_file, port=port, node_bin=state['nodeBin'])
    target = dropin_dir / name
    if not target.exists() or target.read_text() != text:
        dropin_dir.mkdir(exist_ok=True)
        if target.exists():
            shutil.copy2(target, op.path(f'dropin-before-{name}'))
        tmp = target.with_name(target.name + '.tmp')
        tmp.write_text(text)
        os.replace(tmp, target)
        run(['systemctl', 'daemon-reload'])
    (op.path('dropin.conf')).write_text(text)
    props = unit_props(unit, 'DropInPaths', 'WorkingDirectory', 'ExecStart', 'EnvironmentFiles', 'MemoryMax', 'SuccessExitStatus')
    paths = [p for v in props.get('DropInPaths', []) for p in v.split()]
    if not paths or Path(paths[-1]).name != name:
        raise Refused(f'Drop-in {name} is not applied last: {paths[-1:]}')
    if show_value(props, 'WorkingDirectory') != str(release / 'apps/web') or env_file_paths(props.get('EnvironmentFiles')) != [str(env_file)] \
            or exec_argv(show_value(props, 'ExecStart'))[-1:] != [str(release / 'apps/web/server.js')] or show_value(props, 'MemoryMax') != str(CANDIDATE_MEMORY_MAX):
        raise Refused(f'{unit} does not resolve to the drop-in after daemon-reload')

    current = candidate_identity(unit)
    done = state['steps'].get('candidate', {})
    if current['ActiveState'] == 'active' and current['InvocationID'] == done.get('invocationId') and done.get('dropinSha256') == sha256_file(target):
        log(f'{unit} already running this release (invocation {current["InvocationID"]}); warm-up recorded')
        return
    start = state.get('candidateStart', {})
    if current['ActiveState'] == 'active' and current['WorkingDirectory'] == str(release / 'apps/web') and start.get('invocationId') == current['InvocationID'] \
            and start.get('dropinSha256') == sha256_file(target):
        log(f'{unit} already started; waiting for warm-up')
        started_at = start['startedAt']
    else:
        log(f'starting {unit} on 127.0.0.1:{port} from {release.name}')
        run(['systemctl', 'restart', unit])
        started_at = iso()
        # A new process invalidates everything measured or observed on the old one.
        for step in ('candidate', 'capacity', 'ledger', 'plan'):
            state['steps'].pop(step, None)
    current = candidate_identity(unit)
    state['candidateStart'] = {'invocationId': current['InvocationID'], 'mainPid': current['MainPID'], 'startedAt': started_at,
                               'dropin': str(target), 'dropinSha256': sha256_file(target)}
    op.save()

    started = datetime.datetime.fromisoformat(started_at)
    samples_path = op.path('candidate-samples.json')
    samples = read_json(samples_path)['samples'] if samples_path.is_file() and read_json(samples_path).get('invocationId') == current['InvocationID'] else []
    deadline = time.monotonic() + args.warmup_timeout * 60
    sample_slugs = state['sample']['slugs']
    warmup, good_probes = None, 0
    while time.monotonic() < deadline:
        info = candidate_identity(unit)
        if info['ActiveState'] != 'active' or info['InvocationID'] != current['InvocationID']:
            raise Refused(f'{unit} restarted or stopped during warm-up ({info["ActiveState"]}); see journalctl -u {unit}')
        elapsed = (now() - started).total_seconds()
        samples.append([round(elapsed, 1), 'warmup', int(info['MemoryCurrent'] or 0)])
        write_json(samples_path, {'invocationId': current['InvocationID'], 'samples': samples})
        lines = run(['journalctl', '-u', unit, f'_SYSTEMD_INVOCATION_ID={current["InvocationID"]}', '-o', 'cat', '--no-pager', '-g', WARMUP_LINE], check=False).stdout.splitlines()
        finished = warmup_finished(lines)
        if finished:
            warmup = {'mode': 'journal', 'line': finished}
            break
        if args.no_wait:
            warmup = {'mode': 'not_waited', 'elapsedSeconds': elapsed}
            break
        if elapsed >= args.warmup_min_wait * 60:
            rows = probe_latency(port, sample_slugs, state['BUILD_ID'])
            good_probes = good_probes + 1 if latency_acceptable(rows, args.latency_ok) else 0
            if good_probes >= 2:
                warmup = {'mode': 'sampled_latency', 'maxSeconds': args.latency_ok, 'probe': rows, 'elapsedSeconds': elapsed}
                break
        time.sleep(5)
    if not warmup:
        raise Refused(f'No "{WARMUP_LINE}" line and no fast sampled pages within {args.warmup_timeout} min; the candidate keeps running')
    bm = release / f'apps/web/.next/static/{state["BUILD_ID"]}/_buildManifest.js'
    status, body, _, _ = fetch(f'http://127.0.0.1:{port}', f'/_next/static/{state["BUILD_ID"]}/_buildManifest.js', candidate=True)
    if status != 200 or sha256_bytes(body) != sha256_file(bm):
        raise Refused('Candidate does not serve the release BUILD_ID manifest')
    op.done('candidate', unit=unit, port=port, **state['candidateStart'], runtimeEnv=ref(env_file), warmup=warmup,
            warmupMinutes=round((now() - started).total_seconds() / 60, 1))
    log(f'candidate ready ({warmup["mode"]}); next: static')


def cmd_static(args):
    op = open_op(args, 'install')
    state = op.state
    source = Path(state['release']) / 'apps/web/.next/static'
    destination = Path(args.static_dest or discover_static_dest())
    planned, collisions = [], []
    for directory, _, files in os.walk(source):
        for name in sorted(files):
            path = Path(directory) / name
            rel = path.relative_to(source)
            digest = sha256_file(path)
            target = destination / rel
            if target.exists():
                (collisions if sha256_file(target) != digest else planned).append((str(rel), digest, 'identical'))
            else:
                planned.append((str(rel), digest, 'new'))
    if collisions:
        raise Refused('Static collisions (same name, different bytes): ' + ', '.join(c[0] for c in collisions[:5]))
    copied = []
    for rel, digest, kind in planned:
        if kind != 'new':
            continue
        target = destination / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        tmp = target.with_name(target.name + '.program-release-tmp')
        shutil.copy2(source / rel, tmp)
        os.chmod(tmp, 0o644)
        os.replace(tmp, target)
        if sha256_file(target) != digest:
            raise Refused('Copied static file differs: ' + rel)
        copied.append({'url': '/_next/static/' + rel, 'sha256': digest, 'bytes': target.stat().st_size})
    receipt_path = op.path('static-union.json')
    previous = read_json(receipt_path) if receipt_path.is_file() else None
    if previous and previous.get('destination') != str(destination):
        raise Refused('static-union.json was written for ' + previous['destination'])
    if previous and not copied:
        log(f'static already copied ({previous["newFiles"]} new files recorded)')
    else:
        # A rerun only adds files an interrupted run did not copy; earlier copies stay listed.
        files = (previous['files'] if previous else []) + copied
        listed = {f['url'] for f in files}
        write_json(receipt_path, {'schemaVersion': 'uapt-static-resource-union-v1', 'status': 'PASS_COPIED_NOT_SELECTED', 'checkedAt': iso(),
                                  'codeSha': state['codeSha'], 'BUILD_ID': state['BUILD_ID'], 'source': str(source), 'destination': str(destination),
                                  'newFiles': len(files), 'identicalExisting': sum(1 for p in planned if '/_next/static/' + p[0] not in listed),
                                  'collisions': 0, 'oldFilesRetained': True, 'files': files})
    op.done('static', receipt=ref(receipt_path), newFiles=len(copied))
    log(f'static: {len(copied)} new files copied to {destination}; next: capacity')


def discover_static_dest(nginx_root=NGINX_ROOT):
    pattern = re.compile(r'location \^~ /_next/static/ \{\s*alias (/srv/uapt/static/[^;\s]+);')
    found = {m.group(1).rstrip('/') for p in managed_snippets(nginx_root) for m in pattern.finditer(p.read_text())}
    if len(found) != 1:
        raise Refused(f'Cannot determine the /_next/static/ alias ({sorted(found)}); pass --static-dest')
    return found.pop()


def cmd_capacity(args):
    op = open_op(args, 'install', 'candidate')
    state = op.state
    refuse_after_cutover(state, 'capacity')
    info = require_candidate_running(state)
    receipt_path = op.path('capacity.json')
    if receipt_path.is_file() and read_json(receipt_path)['invocationIds'].get(state['candidateUnit']) == info['InvocationID'] and not args.force:
        log('capacity already measured for this candidate invocation')
        return
    unit, port = state['candidateUnit'], state['candidatePort']
    samples_path = op.path('candidate-samples.json')
    samples = [tuple(s) for s in read_json(samples_path)['samples']] if samples_path.is_file() and read_json(samples_path).get('invocationId') == info['InvocationID'] else []
    started = datetime.datetime.fromisoformat(state['steps']['candidate']['startedAt'])
    stage = ['cold_history']
    stop = threading.Event()

    def sampler():
        while not stop.is_set():
            samples.append(((now() - started).total_seconds(), stage[0], int(show_value(unit_props(unit, 'MemoryCurrent'), 'MemoryCurrent') or 0)))
            stop.wait(1)

    thread = threading.Thread(target=sampler, daemon=True)
    thread.start()
    slugs = state['sample']['slugs']
    log(f'capacity: cold request pass over {len(HEAVY_PATHS) + 3 * len(slugs)} routes, then 60 s steady')
    rows = pool(HEAVY_PATHS + school_paths(slugs), lambda p: (p, fetch(f'http://127.0.0.1:{port}', p, candidate=True, attempts=1, timeout=300)[0]))
    stage[0] = 'steady'
    time.sleep(60)
    stop.set()
    thread.join()
    after = candidate_identity(unit)
    if after['MainPID'] != info['MainPID'] or after['InvocationID'] != info['InvocationID']:
        raise Refused('Candidate restarted during measurement')
    receipt = capacity_receipt(samples=samples, request_rows=rows, code_sha=state['codeSha'], build_id=state['BUILD_ID'],
                               basis_sha=state['basis']['sha256'], unit=unit, pid=info['MainPID'], invocation=info['InvocationID'])
    limit = read_json(POLICY)['candidatePeakMaxBytes']
    if max(receipt['peakBytesByStage'].values()) > limit:
        raise Refused(f'Measured peak {receipt["peakBytesByStage"]} exceeds candidatePeakMaxBytes {limit}')
    write_json(receipt_path, receipt)
    op.done('capacity', receipt=ref(receipt_path), peakBytesByStage=receipt['peakBytesByStage'])
    log(f'capacity {receipt["peakBytesByStage"]}; next: routing')


def cmd_routing(args):
    op = open_op(args, 'install')
    state = op.state
    if 'cutover' in state['steps']:
        raise Refused('Already cut over; routing files are frozen in the plan')
    out = op.path('routing')
    if out.exists():
        shutil.move(str(out), str(op.path(f'routing.superseded-{now().strftime("%Y%m%dT%H%M%S")}')))
    if state['steps'].pop('plan', None):
        op.save()
        log('routing regenerated: the previous plan is void; rerun plan')
    replacements = dict(item.split('=', 1) for item in args.replace or [])
    result = generate_routing(NGINX_ROOT, out, state['activePort'], state['candidatePort'], state['codeSha'], replacements)
    if not result['routingFiles']:
        raise Refused(f'No /etc/nginx/snippets/uapt-*.conf routes to 127.0.0.1:{state["activePort"]}')
    if result['oldPortLeftInStaged']:
        raise Refused('Old port left in staged files: ' + ', '.join(result['oldPortLeftInStaged']))
    unmanaged = unmanaged_references(NGINX_ROOT, state['activePort'])
    if unmanaged:
        raise Refused(f'127.0.0.1:{state["activePort"]} is referenced outside the managed snippets (the controller cannot switch it): ' + ', '.join(unmanaged))
    test = isolated_nginx_test(NGINX_ROOT, result['routingFiles'], op.dir, retired_port=state['activePort'])
    result['nginxTest'] = test
    write_json(out / 'routing-files.json', result)
    if test.get('retiredEndpointInConfig'):
        raise Refused(f'127.0.0.1:{state["activePort"]} is still in the effective nginx config after switching (nginx -T of the copy)')
    if not test['ok']:
        raise Refused('Isolated nginx -T failed: ' + test['output'])
    op.done('routing', receipt=ref(out / 'routing-files.json'), files=len(result['routingFiles']), replacements=result['replacements'])
    log(f'routing: {len(result["routingFiles"])} snippets, {result["replacements"]} references {state["activePort"]} -> {state["candidatePort"]}; nginx -t ok; next: ledger')


def candidate_mcp_observation(state, slugs):
    endpoint, catalog_path = state['mcp']['endpoint'], state['mcp']['catalog']
    if not endpoint or not catalog_path:
        raise Refused('MCP endpoint/catalog unknown; pass --mcp-endpoint and --mcp-catalog to install')
    status, body, _, _ = fetch(f'http://{endpoint}', '/healthz', candidate=False)
    health = json.loads(body) if status == 200 else {}
    raw = Path(catalog_path).read_bytes()
    catalog = json.loads(raw)
    if not health.get('ok') or health.get('releaseId') != catalog['payload']['releaseId']:
        raise Refused('MCP healthz release differs from its catalog file')
    observed = {}
    for record in catalog['payload']['records']:
        slug = record['summary']['entity']['slug']
        if slug in slugs:
            observed[slug] = sorted(c['id'] for c in record['summary']['claims'])
    return {'endpoint': endpoint, 'health': health, 'catalog': catalog_path, 'catalogSha256': sha256_bytes(raw), 'claimIdsBySlug': observed}


def runtime_content_state(port, token):
    status, body, _, _ = http_get(f'http://127.0.0.1:{port}/api/internal/content/refresh', {'Host': '127.0.0.1', 'Authorization': f'Bearer {token}'}, 30)
    if status != 200:
        raise Refused(f'Runtime content state unavailable ({status})')
    value = json.loads(body)
    selected = value.get('selected') or value.get('active') or {}
    return {**value, 'manifestSha256': value.get('manifestSha256') or selected.get('manifestSha256'), 'contentId': value.get('contentId') or selected.get('contentId')}


def choose_sample(state, *, readback='auto', size=SAMPLE_SIZE, extra=(), content_event=None):
    """Schools the candidate and public readbacks cover, chosen once per operation
    from the content release's own synchronized scope."""
    pointer = require_unchanged_content(state)
    event_path = Path(content_event) if content_event else find_content_event(pointer)
    event = verify_content_event(event_path, pointer)
    content_dir = event_path.parent
    scope = read_json(content_dir / event['scopeArtifact']['path'])
    mode, reason = resolve_mode(readback, state, previous_plan())
    if mode == 'full':
        slugs = [u['slug'] for u in scope['universities']]
        reasons = {s: ['full synchronized scope'] for s in slugs}
    else:
        summaries = read_json(content_dir / _typed_receipt(content_dir, event, 'public_data')['dataArtifact']['path'])
        slugs, reasons = select_sample(summaries, scope['changedRevisionsBySlug'], size, extra)
    return {'mode': mode, 'reason': reason, 'slugs': slugs, 'reasons': reasons, 'contentEvent': str(event_path),
            'contentEventId': event['eventId'], 'scopeUniversities': len(scope['universities'])}


def resolve_mode(requested, state, previous):
    if requested in ('sample', 'full'):
        return requested, 'requested with --readback ' + requested
    prior = None
    if previous:
        try:
            prior = read_json(previous['basis']['path']).get('contentRelease')
        except (OSError, KeyError, ValueError):
            prior = None
    current = {k: state['content'][k] for k in ('root', 'contentId', 'manifestSha256')}
    if prior and {k: prior.get(k) for k in current} == current:
        return 'sample', f'content {current["contentId"]} is the one the previous accepted program release ({previous["id"]}) served'
    return 'full', 'content differs from the previous accepted program release (or none is recorded)'


def cmd_ledger(args):
    op = open_op(args, 'install', 'candidate')
    state = op.state
    pointer = require_unchanged_content(state)
    require_candidate_running(state)
    out = op.path('sync/program')
    if out.exists():
        if not args.force and 'ledger' in state['steps']:
            log(f'ledger exists: {out / "event.json"} (use --force for fresh evidence)')
            return
        shutil.move(str(out), str(op.path(f'sync/program.superseded-{now().strftime("%Y%m%dT%H%M%S")}')))
    if args.readback != 'auto' or args.sample_size != SAMPLE_SIZE or args.sample_slug or args.content_event:
        state['sample'] = choose_sample(state, readback=args.readback, size=args.sample_size, extra=args.sample_slug or (), content_event=args.content_event)
        op.save()
    sample = state['sample']
    event_path = Path(sample['contentEvent'])
    content_event = verify_content_event(event_path, pointer)
    content_dir = event_path.parent
    content_scope = read_json(content_dir / content_event['scopeArtifact']['path'])
    mode, reason, slugs, reasons = sample['mode'], sample['reason'], sample['slugs'], sample['reasons']
    log(f'ledger: {mode} readback of {len(slugs)} schools ({reason})')
    expected = {u['slug']: u['publicClaimIds'] for u in content_scope['universities'] if u['slug'] in set(slugs)}
    port, build_id = state['candidatePort'], state['BUILD_ID']
    bm_sha = sha256_file(Path(state['release']) / f'apps/web/.next/static/{build_id}/_buildManifest.js')
    result = readback(f'http://127.0.0.1:{port}', slugs, build_id, candidate=True)
    problems = readback_problems(result, expected, bm_sha)
    if problems:
        write_json(op.path('ledger-problems.json'), problems)
        raise Refused(f'Candidate readback failed for {len(problems)} checks (ledger-problems.json): {json.dumps(problems[:3])}')
    mcp = candidate_mcp_observation(state, set(slugs))
    for slug in slugs:
        if mcp['claimIdsBySlug'].get(slug) != sorted(expected[slug]):
            raise Refused('MCP Claim IDs differ from scope: ' + slug)
    token = parse_env(op.path('runtime.env').read_text()).get('UAPT_CONTENT_REFRESH_TOKEN', '')
    runtime = runtime_content_state(port, token)
    if runtime['manifestSha256'] != state['content']['manifestSha256'] or runtime['contentId'] != state['content']['contentId']:
        raise Refused('Candidate serves a different content release')
    candidate_readback = {'schemaVersion': 'uapt-program-candidate-readback-v1', 'candidate': f'127.0.0.1:{port} ({state["candidateUnit"]})',
                          'buildId': build_id, 'contentId': state['content']['contentId'], 'contentManifestSha256': state['content']['manifestSha256'],
                          'runtimeState': runtime, **result, 'mcp': {k: mcp[k] for k in ('endpoint', 'health', 'catalog', 'catalogSha256')}}
    event = build_program_event(content_dir=content_dir, content_event=content_event, out_dir=out, basis_file=state['basis']['path'],
                                sample=slugs, sample_reasons=reasons, mode=mode, mode_reason=reason, candidate_readback=candidate_readback,
                                mcp=mcp, runtime_state=runtime, event_id=f'uapt-{state["planId"]}-candidate',
                                content_manifest_sha256=state['content']['manifestSha256'])
    verify_sync(state, event, 'candidate', op.path('ledger.log'))
    op.done('ledger', event=ref(event), mode=mode, reason=reason, sample=slugs, contentEvent=str(event_path))
    log(f'ledger: {event} passed the sync gate; next: routing (if not done) then plan')


def release_helper(state):
    previous = previous_plan()
    path = state.get('releaseHelper') or (previous or {}).get('releaseHelper')
    if not path or not Path(path).is_file():
        raise Refused('Release helper (uapt-release.mjs with verify-sync) unknown; pass --helper')
    return {'path': path, 'sha256': sha256_file(path)}


def verify_sync(state, event_path, phase, log_path):
    helper = release_helper(state)
    node = shutil.which('node') or state['nodeBin']
    result = run([node, helper['path'], 'verify-sync', event_path, Path(event_path).parent / 'basis.json', phase], check=False)
    Path(log_path).write_text(result.stdout + result.stderr)
    if result.returncode != 0:
        raise Refused(f'Sync gate ({phase}) rejected {event_path}: {(result.stderr or result.stdout)[-2000:]}')


def controller_call(op, action, *extra, log_name):
    result = run([sys.executable, CONTROLLER, action, *extra], check=False)
    op.path(log_name).write_text(result.stdout + result.stderr)
    return result


def cmd_plan(args):
    op = open_op(args, 'install', 'candidate', 'static', 'capacity', 'routing', 'ledger')
    state = op.state
    if 'cutover' in state['steps']:
        raise Refused('Already cut over with ' + state['steps']['plan']['plan'])
    if args.helper:
        state['releaseHelper'] = args.helper
    require_unchanged_content(state)
    info = require_candidate_running(state)
    capacity = read_json(state['steps']['capacity']['receipt']['path'])
    if capacity['invocationIds'].get(state['candidateUnit']) != info['InvocationID'] or str(capacity['mainPids'].get(state['candidateUnit'])) != info['MainPID']:
        raise Refused('capacity.json was measured on another candidate process; rerun capacity')
    routing = read_json(op.path('routing/routing-files.json'))
    drift = [f['target'] for f in routing['routingFiles'] if sha256_file(f['target']) != f['beforeSha256']]
    if drift:
        raise Refused('Live nginx snippets changed since routing; rerun routing: ' + ', '.join(drift))
    lc = load_controller()
    policy = read_json(POLICY)
    policy_sha = sha256_file(POLICY)
    observed = lc.audit()
    register = read_json(policy['retentionRegister'])
    install = read_json(state['installReceipt']) if state.get('installReceipt') else {}
    entry = dict(install.get('retentionEntry') or {'name': Path(state['release']).name, 'disposition': 'candidate'})
    entry.update({'disposition': 'candidate', 'reason': (entry.get('reason') or f'Program {state["codeSha"][:12]} {state["BUILD_ID"]}') +
                  f'; candidate on {state["candidateUnit"]} ({state["candidatePort"]}), operation {op.dir.name}',
                  'codeSha': state['codeSha'], 'BUILD_ID': state['BUILD_ID'], 'role': args.role,
                  'sourceManifestSha256': read_json(state['basis']['path'])['sourceManifestSha256']})
    retention = build_retention_receipt(register, observed['disk']['releaseRoots'], observed['disk'].get('temporaryPaths', []), entry, state['basis']['sha256'])
    retention_path = write_json(op.path('retention.json'), retention)
    previous = previous_plan() or {}
    disk_budget = dict(previous.get('diskBudget') or {'schemaVersion': 'uapt-release-disk-budget-v1', 'role': args.role, 'artifactMaxBytes': policy['diskCapacity']['artifactMaxBytesByRole'][args.role],
                                                      'peakAdditionalBytesByStage': {'download': 0, 'unpack': 0, 'dependencies': 0, 'build': 0, 'candidate': 1 << 30, 'archive': 0, 'finalization': 16 << 20}})
    disk_budget['role'] = args.role
    expires = plan_expiry(now(), args.plan_hours, policy.get('candidateTtlHours', 4), datetime.datetime.fromisoformat(state['steps']['candidate']['startedAt']))
    candidate_peak, build_peak = peak_budgets(capacity['peakBytesByStage'], previous, policy, args.candidate_peak_bytes, args.build_peak_bytes)
    plan_id = next_plan_id(state['planId'], LIFECYCLE / 'transactions')
    state.setdefault('planIds', []).append(plan_id)
    op.save()
    build_id = state['BUILD_ID']
    plan = build_plan(
        plan_id=plan_id, expires_at=iso(expires), policy_sha=policy_sha,
        basis=state['basis'], sync_ledger=state['steps']['ledger']['event'], retention=ref(retention_path),
        static_receipt=state['steps']['static']['receipt'], capacity=state['steps']['capacity']['receipt'],
        runtime_env=ref(op.path('runtime.env')), helper=release_helper(state), routing_files=routing['routingFiles'], build_id=build_id,
        build_manifest_sha256=sha256_file(Path(state['release']) / f'apps/web/.next/static/{build_id}/_buildManifest.js'),
        candidate_unit=state['candidateUnit'], candidate_port=state['candidatePort'], active_unit=state['activeUnit'],
        active_port=state['activePort'], keep_active=[u for u in policy['activeUnits'] if u != state['activeUnit']], disk_budget=disk_budget,
        candidate_peak=candidate_peak, build_peak=build_peak,
        purpose=args.purpose or f'Program {state["codeSha"][:12]} {build_id} (operation {op.dir.name}) on {state["candidateUnit"]} '
                                f'127.0.0.1:{state["candidatePort"]} with runtime content {state["content"]["contentId"]}; '
                                f'{state["activeUnit"]} (127.0.0.1:{state["activePort"]}) retires at completion.')
    plan_path = write_json(op.path('plan.json'), plan)
    plan_stub = {'basis': state['basis'], 'retentionReceipt': ref(retention_path)}
    lc.validate_retention_receipt(plan_stub, observed, policy)
    result = controller_call(op, 'gate', plan_path, log_name='gate.log')
    if result.returncode != 0:
        raise Refused('Controller gate refused: ' + (result.stderr or result.stdout)[-2000:])
    op.done('plan', plan=str(plan_path), planSha256=sha256_file(plan_path), expiresAt=plan['expiresAt'], planId=plan_id)
    log(f'gate passed; plan {plan_path} expires {plan["expiresAt"]}; next: cutover (needs authorization)')


def transaction():
    return read_json(TRANSACTION) if TRANSACTION.is_file() else {}


def cmd_cutover(args):
    op = open_op(args, 'plan')
    state = op.state
    plan_id = state['steps']['plan']['planId']
    tx = transaction()
    if tx.get('plan', {}).get('id') == plan_id and tx.get('stage') in ('selected_pending_acceptance', 'complete'):
        log(f'transaction {state["planId"]} already {tx["stage"]}')
        op.done('cutover', stage=tx['stage'])
        return
    if sha256_file(state['steps']['plan']['plan']) != state['steps']['plan']['planSha256']:
        raise Refused('plan.json changed after the gate; rerun plan')
    # The controller fails on routing drift only after creating its transaction directory.
    for item in read_json(state['steps']['plan']['plan'])['routingFiles']:
        if sha256_file(item['target']) != item['beforeSha256'] or sha256_file(item['source']) != item['sha256']:
            raise Refused('Routing drift since plan (' + item['target'] + '); rerun routing and plan')
    started = time.monotonic()
    result = controller_call(op, 'cutover', state['steps']['plan']['plan'], log_name='cutover.log')
    if result.returncode != 0:
        raise Refused('Controller cutover failed (it recovers on failure): ' + (result.stderr or result.stdout)[-2000:])
    op.done('cutover', stage=transaction().get('stage'), seconds=round(time.monotonic() - started))
    log('selected; next: complete (public readback, completion ledger, retirement)')


def cmd_complete(args):
    op = open_op(args, 'cutover', 'ledger')
    state = op.state
    plan_id = state['steps']['plan']['planId']
    tx = transaction()
    if tx.get('plan', {}).get('id') != plan_id:
        raise Refused('The pending transaction is not this operation\'s plan')
    out = op.path('sync/program-complete')
    if tx.get('stage') == 'selected_pending_acceptance':
        if out.exists() and args.force:
            shutil.move(str(out), str(op.path(f'sync/program-complete.superseded-{now().strftime("%Y%m%dT%H%M%S")}')))
        if not out.exists():
            slugs = state['steps']['ledger']['sample']
            scope = read_json(op.path('sync/program/scope.json'))
            expected = {u['slug']: u['publicClaimIds'] for u in scope['universities']}
            bm_sha = sha256_file(Path(state['release']) / f'apps/web/.next/static/{state["BUILD_ID"]}/_buildManifest.js')
            log(f'public readback of {len(slugs)} schools on {ORIGIN}')
            result = readback(ORIGIN, slugs, state['BUILD_ID'], candidate=False, query=f'uapt_readback={state["planId"]}' if args.cache_bust else '')
            problems = readback_problems(result, expected, bm_sha)
            if problems:
                write_json(op.path('complete-problems.json'), problems)
                raise Refused(f'Public readback failed for {len(problems)} checks (complete-problems.json): {json.dumps(problems[:3])}')
            event = build_completion_event(candidate_dir=op.path('sync/program'), out_dir=out, public_readback={'buildId': state['BUILD_ID'], **result})
            verify_sync(state, event, 'complete', op.path('complete-ledger.log'))
        event = out / 'event.json'
        for attempt in (1, 2):
            result = controller_call(op, 'complete', '--completion-ledger', event, log_name=f'complete-{attempt}.log')
            if result.returncode == 0:
                break
            failed = [u for u in tx['retireUnits'] if show_value(unit_props(u, 'ActiveState'), 'ActiveState') == 'failed']
            if attempt == 1 and failed and 'Retirement failed' in (result.stderr + result.stdout):
                log('retired unit ended failed (exit status); systemctl reset-failed and retry: ' + ', '.join(failed))
                for unit in failed:
                    run(['systemctl', 'reset-failed', unit])
                continue
            raise Refused('Controller complete refused: ' + (result.stderr or result.stdout)[-2000:])
        tx = transaction()
    if tx.get('stage') != 'complete':
        raise Refused('Transaction is ' + str(tx.get('stage')))
    update = tx.get('retentionRegister')
    if not update:
        raise Refused('The installed controller did not update the retention register at complete; install the controller from this '
                      'repository (docs/program-release.md section 7) and record the register by hand once.')
    check = controller_call(op, 'retention', log_name='retention.log')
    result = {'schemaVersion': 'uapt-program-release-result-v1', 'status': 'COMPLETE' if check.returncode == 0 else 'COMPLETE_RETENTION_CHECK_FAILED',
              'completedAt': tx.get('completedAt'), 'planId': plan_id, 'codeSha': state['codeSha'], 'BUILD_ID': state['BUILD_ID'],
              'release': state['release'], 'unit': state['candidateUnit'], 'endpoint': f'127.0.0.1:{state["candidatePort"]}',
              'retired': tx.get('retireUnits'), 'content': {k: state['content'][k] for k in ('root', 'contentId', 'manifestSha256')},
              'ledger': {'mode': state['steps']['ledger']['mode'], 'schools': len(state['steps']['ledger']['sample']),
                         'candidate': 'sync/program/event.json', 'complete': 'sync/program-complete/event.json'},
              'retentionRegister': update, 'retentionCheck': (check.stdout + check.stderr).strip()[-1000:],
              'notifications': 'none (separate authorization)', 'cdn': 'not purged by this command',
              'stepTimes': {k: v.get('at') for k, v in state['steps'].items()}}
    write_json(op.path('RESULT.json'), result)
    op.done('complete', result=ref(op.path('RESULT.json')), status=result['status'])
    if check.returncode != 0:
        raise Refused('Release complete, but the read-only retention check fails (next release would be blocked): ' + result['retentionCheck'])
    log(f'complete: {state["release"]} active on {state["candidateUnit"]}; register {update.get("summary")}')


def cmd_status(args):
    op = Operation(args.op)
    state = op.load()
    order = ['install', 'candidate', 'static', 'capacity', 'routing', 'ledger', 'plan', 'cutover', 'complete']
    steps = state.get('steps', {})
    print(json.dumps({'op': str(op.dir), 'planId': state['planId'], 'codeSha': state['codeSha'], 'BUILD_ID': state['BUILD_ID'],
                      'candidate': f'{state["candidateUnit"]} 127.0.0.1:{state["candidatePort"]}', 'retiring': f'{state["activeUnit"]} 127.0.0.1:{state["activePort"]}',
                      'steps': {s: steps.get(s, {}).get('at', 'pending') for s in order},
                      'next': next((s for s in order if s not in steps), None), 'transaction': transaction().get('stage')}, indent=2))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)

    def add(name, func, op_required=True):
        p = sub.add_parser(name)
        p.add_argument('--op', required=op_required, help='operation directory')
        p.set_defaults(func=func)
        return p

    p = add('install', cmd_install, op_required=False)
    p.add_argument('--sha', required=True)
    source = p.add_mutually_exclusive_group()
    source.add_argument('--run-id', type=int)
    source.add_argument('--zip')
    source.add_argument('--existing-release', help='re-release an installed root (rollback); nothing is downloaded')
    p.add_argument('--repo', default=DEFAULT_REPO)
    p.add_argument('--installer', default=str(next((c for c in (Path(__file__).resolve().parent / 'uapt-program-artifact-install.py',
                                                                   Path(__file__).resolve().parents[1] / 'program-artifact-install.py') if c.is_file()),
                                                     '/usr/local/libexec/uapt-program-artifact-install.py')))
    p.add_argument('--production-env', help='default: the active web slot env file')
    p.add_argument('--env', help='runtime env to copy (default: the active web slot env file)')
    p.add_argument('--node-bin', help='default: the active web slot ExecStart node')
    p.add_argument('--slot', action='append', help='fixed web slot unit=port (twice); default 3101/3102 slots')
    p.add_argument('--mcp-endpoint', help='default: 127.0.0.1:<UAPT_MCP_PORT> of the active MCP unit')
    p.add_argument('--mcp-catalog', help='default: UAPT_MCP_CATALOG of the active MCP unit')
    p.add_argument('--helper', help='uapt-release.mjs for verify-sync (default: the previous completed plan\'s)')
    p.add_argument('--readback', choices=['auto', 'sample', 'full'], default='auto',
                   help='auto: sample when the content release is the one the previous accepted program served, else full')
    p.add_argument('--sample-size', type=int, default=SAMPLE_SIZE)
    p.add_argument('--sample-slug', action='append', help='always include this school (repeatable)')
    p.add_argument('--content-event', help='content sync event.json (default: found by the pointer hash)')

    p = add('candidate', cmd_candidate)
    p.add_argument('--env', help='runtime env to copy instead of the one recorded at install')
    p.add_argument('--warmup-timeout', type=int, default=120, help='minutes (default 120)')
    p.add_argument('--warmup-min-wait', type=int, default=10, help='minutes before the sampled-latency fallback (default 10)')
    p.add_argument('--latency-ok', type=float, default=5.0, help='max seconds per sampled page for the fallback (default 5)')
    p.add_argument('--no-wait', action='store_true', help='do not wait for warm-up (recorded as not_waited)')

    p = add('static', cmd_static)
    p.add_argument('--static-dest', help='default: the /_next/static/ alias in the managed snippets')

    p = add('capacity', cmd_capacity)
    p.add_argument('--force', action='store_true')

    p = add('routing', cmd_routing)
    p.add_argument('--replace', action='append', metavar='SNIPPET=FILE',
                   help='stage reviewed new content for a managed snippet (e.g. uapt-proxy-locations.conf=<generated minimal routing>); repeatable')

    p = add('ledger', cmd_ledger)
    p.add_argument('--readback', choices=['auto', 'sample', 'full'], default='auto', help='override the scope chosen at install')
    p.add_argument('--sample-size', type=int, default=SAMPLE_SIZE)
    p.add_argument('--sample-slug', action='append', help='always include this school (repeatable)')
    p.add_argument('--content-event', help='content sync event.json (default: the one chosen at install)')
    p.add_argument('--force', action='store_true', help='supersede an existing ledger with fresh evidence')

    p = add('plan', cmd_plan)
    p.add_argument('--role', default='main')
    p.add_argument('--plan-hours', type=float, default=7)
    p.add_argument('--candidate-peak-bytes', type=int)
    p.add_argument('--build-peak-bytes', type=int)
    p.add_argument('--helper', help='uapt-release.mjs used for verify-sync (default: the previous plan\'s)')
    p.add_argument('--purpose')

    add('cutover', cmd_cutover)

    p = add('complete', cmd_complete)
    p.add_argument('--no-cache-bust', dest='cache_bust', action='store_false', help='read public pages without the ?uapt_readback= query')
    p.add_argument('--force', action='store_true', help='redo the public readback before the controller completes')

    add('status', cmd_status)

    args = parser.parse_args(argv)
    try:
        if args.command != 'status' and os.geteuid() != 0:
            raise Refused('Run as root on the release host')
        args.func(args)
    except (Refused, ValueError, OSError, KeyError) as error:
        print(f'Refused: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
