#!/usr/bin/env python3
"""S8b: enroll a released V6 batch's official sources in the OpenClaw source monitor (docs/v6-pipeline.md §2.4).

  pnpm v6:openclaw-enroll --workspace <ws> [plan]       live API (paced) + parent state (read-only) + build; no host writes
  pnpm v6:openclaw-enroll --workspace <ws> dry-run      validate the payload on the host (GET-only, temporary copy)
  pnpm v6:openclaw-enroll --workspace <ws> install --approve <payload-manifest sha256> --authorization "<owner quote>"
  pnpm v6:openclaw-enroll --workspace <ws> readback     GET-only readback of the installed enrollment
  pnpm v6:openclaw-enroll --workspace <ws> status       local receipt only
  options: --refresh-live, --refresh-parent (refetch instead of reusing), --public-base <url>, --env-file <file>

Ports the hand-run batch-3 enrollment (batch3-20261120/openclaw-enrollment{,-r2}, 2026-11-21) into the pipeline. Everything
lives in <ws>/openclaw/<contentId>/: live-api/, parent/ (byte copies of the monitor state), payload/ (sources.json,
coverage.json, enrollment.json, baselines), install.py (= openclaw_install.py), payload-manifest.json, host/ (receipts
pulled back) and receipt.json (uapt-v6-openclaw-enrollment-receipt-v1, one entry per step).

Additive and idempotent: a URL that is already watched gains a binding only when this school/source/Claim binding is
missing; a school already at this content id and revision is not touched; a rebuild after install finds nothing to do
(status nothing_to_enroll). The payload is deterministic for the same inputs, so the owner approves the
payload-manifest.json SHA256 once; install refuses any other bytes and a host whose state moved since the parent fetch.

Host access: SSH as OPENCLAW_USER (with sudo -n -u openclaw) to OPENCLAW_HOST with OPENCLAW_SSH_KEY, read from the
environment or --env-file / .env.agents.local (only those three keys are read, never printed). plan reads files with
tar, dry-run and readback only GET the monitor API; only install writes (the enrollment folder, sources.json,
watch-bindings.json, new baselines, new watches and tags).
"""
import argparse, base64, hashlib, io, json, os, re, runpy, shlex, shutil, subprocess, sys, tarfile
from pathlib import Path
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v6batch as B  # noqa: E402

HERE = Path(__file__).resolve().parent
INSTALLER = HERE / 'openclaw_install.py'
MONITOR_BASE = '/home/openclaw/.local/share/uapt-monitor'
PARENT_FILES = ('sources.json', 'watch-bindings.json', 'source-resolutions.json', 'fetch-policy.json',
                'monitor_control.py', 'monitor_noise.py')
SELF_SITE = ('eduaipolicy.org',)
RECEIPT_SCHEMA = 'uapt-v6-openclaw-enrollment-receipt-v1'
PAYLOAD_SCHEMA = 'uapt-v6-openclaw-payload-v1'
CID = re.compile(r'^c-[a-z0-9][a-z0-9-]{2,80}$')
HEX64 = re.compile(r'^[0-9a-f]{64}$')
DEFAULT_PUBLIC = 'https://eduaipolicy.org'


class Refused(Exception):
    pass


def sha_bytes(raw):
    return hashlib.sha256(raw).hexdigest()


def sha(path):
    return sha_bytes(Path(path).read_bytes())


def dump(value):
    # Same serialisation as the host's monitor_control.save, so installed bytes equal payload bytes.
    return json.dumps(value, ensure_ascii=False, indent=2)


def read(path):
    return json.loads(Path(path).read_text())


def norm(url):
    p = urlsplit(url.strip())
    host = p.netloc.lower()
    host = host[4:] if host.startswith('www.') else host
    return (host, p.path.rstrip('/'), p.query)


def self_site(url):
    host = (urlsplit(url or '').hostname or '').lower().rstrip('.')
    return any(host == d or host.endswith('.' + d) for d in SELF_SITE)


def note_key(cid):
    return 'enrollmentV6_' + re.sub(r'[^A-Za-z0-9]+', '_', cid.removeprefix('c-'))


def enrollment_dir(ws, batch):
    cid = batch.get('contentId') or ''
    if not CID.match(cid):
        raise Refused('batch.json needs the released contentId (c-...)')
    return Path(ws) / 'openclaw' / cid


# ---------------------------------------------------------------- receipt

def receipt(edir, step, **fields):
    path = edir / 'receipt.json'
    value = read(path) if path.is_file() else {'schemaVersion': RECEIPT_SCHEMA, 'steps': []}
    value['steps'].append({'step': step, 'at': B.now(), **fields})
    value.update({k: v for k, v in fields.items() if k in ('status', 'next', 'payloadManifestSha256')})
    value['updatedAt'] = B.now()
    edir.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp'); tmp.write_text(json.dumps(value, ensure_ascii=False, indent=1) + '\n'); os.replace(tmp, path)
    return value


# ---------------------------------------------------------------- live public API (read-only, paced)

def public_reader(base):
    release = runpy.run_path(str(B.REPO / 'scripts/release/content-release.py'))
    return release['PublicReader'](base, timeout=120)


def fetch_live(ws, batch, edir, base=DEFAULT_PUBLIC, reader=None, refresh=False):
    """One request per school, ≤ 5/s, 429 waited out. Proves the batch is live: recordRevision.universityRevisionId
    must be the batch revision (the V6 projection published by this content release)."""
    out = edir / 'live-api'
    have = all((out / f"{s['slug']}.json").is_file() for s in batch['schools']) and (out / 'receipt.json').is_file()
    if have and not refresh:
        return read(out / 'receipt.json')
    reader = reader or public_reader(base)
    rows, problems = {}, []
    out.mkdir(parents=True, exist_ok=True)
    for s in batch['schools']:
        status, body, _headers, _seconds = reader(f"/api/public/v1/universities/{s['slug']}.json")
        row = {'status': status, 'sha256': sha_bytes(body or b'')}
        if status != 200:
            problems.append(f"{s['slug']}: HTTP {status}"); rows[s['slug']] = row; continue
        record = json.loads(body)
        revision = (record.get('recordRevision') or {})
        row.update(universityRevisionId=revision.get('universityRevisionId'), recordSha256=revision.get('recordSha256'),
                   claimIds=sorted(c['id'] for c in record['data']['claims']))
        if revision.get('universityRevisionId') != batch['revision']:
            problems.append(f"{s['slug']}: live revision {revision.get('universityRevisionId')} is not {batch['revision']}")
        (out / f"{s['slug']}.json").write_bytes(body)
        rows[s['slug']] = row
    value = {'base': base, 'fetchedAt': B.now(), 'requests': getattr(reader, 'requests', None),
             'rateLimited': getattr(reader, 'rate_limited', None), 'schools': rows, 'problems': problems}
    (out / 'receipt.json').write_text(json.dumps(value, ensure_ascii=False, indent=1) + '\n')
    if problems:
        raise Refused('The batch is not live as released: ' + '; '.join(problems[:5]))
    return value


# ---------------------------------------------------------------- OpenClaw host

def host_config(env_file=None):
    keys = ('OPENCLAW_HOST', 'OPENCLAW_USER', 'OPENCLAW_SSH_KEY')
    found = {k: os.environ[k] for k in keys if os.environ.get(k)}
    candidates = [Path(env_file)] if env_file else [B.REPO / '.env.agents.local']
    for path in candidates:
        if len(found) == len(keys) or not path.is_file():
            continue
        for line in path.read_text().splitlines():
            m = re.match(r'^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*?)\s*$', line)
            if m and m[1] in keys and m[1] not in found:
                found[m[1]] = m[2].strip('\'"')
    missing = [k for k in keys if not found.get(k)]
    if missing:
        raise Refused('OpenClaw host access needs ' + ', '.join(missing) + ' (environment, --env-file or .env.agents.local)')
    found['OPENCLAW_SSH_KEY'] = os.path.expanduser(found['OPENCLAW_SSH_KEY'])
    return found


class Remote:
    """One SSH command per call; commands run as `openclaw` via sudo -n. stdout/stderr are returned, never echoed."""
    def __init__(self, config, base=MONITOR_BASE, timeout=900):
        self.config, self.base, self.timeout = config, base, timeout

    def __call__(self, command, stdin=None, timeout=None):
        ssh = ['ssh', '-i', self.config['OPENCLAW_SSH_KEY'], '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20',
               f"{self.config['OPENCLAW_USER']}@{self.config['OPENCLAW_HOST']}",
               'sudo -n -u openclaw bash -c ' + shlex.quote('set -euo pipefail; ' + command)]
        done = subprocess.run(ssh, input=stdin, capture_output=True, timeout=timeout or self.timeout)
        return done.returncode, done.stdout, done.stderr.decode('utf-8', 'replace')[-2000:]


def fetch_parent(ws, batch, edir, remote, refresh=False):
    """Read-only: tar the monitor state files (and existing baselines of this batch's schools) from the host."""
    out = edir / 'parent'
    if (out / 'receipt.json').is_file() and not refresh:
        return read(out / 'receipt.json')
    slugs = [s['slug'] for s in batch['schools']]
    assert all(B.SLUG.match(s) for s in slugs)
    base = shlex.quote(remote.base)
    names = ' '.join(PARENT_FILES)
    baselines = ' '.join(f'baseline/{s}.json' for s in slugs)
    command = (f'cd {base}; files="{names}"; for f in {baselines}; do if [ -f "$f" ]; then files="$files $f"; fi; done; '
               'tar -c -f - $files')
    code, raw, err = remote(command, timeout=300)
    if code:
        raise Refused('Reading the monitor state failed (exit ' + str(code) + '): ' + err.strip()[-300:])
    if out.exists():
        shutil.rmtree(out)
    (out / 'baseline').mkdir(parents=True)
    allowed = set(PARENT_FILES) | {f'baseline/{s}.json' for s in slugs}
    with tarfile.open(fileobj=io.BytesIO(raw)) as tar:
        for member in tar.getmembers():
            if member.name not in allowed or not member.isfile():
                raise Refused('Unexpected entry in the monitor state archive: ' + member.name)
            (out / member.name).write_bytes(tar.extractfile(member).read())
    missing = [n for n in PARENT_FILES if not (out / n).is_file()]
    if missing:
        raise Refused('Monitor state incomplete: ' + ', '.join(missing))
    value = {'fetchedAt': B.now(), 'monitorBase': remote.base,
             'files': {n: sha(out / n) for n in PARENT_FILES},
             'baselines': {p.name: sha(p) for p in sorted((out / 'baseline').glob('*.json'))}}
    (out / 'receipt.json').write_text(json.dumps(value, indent=1) + '\n')
    return value


# ---------------------------------------------------------------- build (local, no network)

def load_captures(ws):
    captures = {}
    for path in sorted(Path(ws).glob('captures/*/*.json')):
        try:
            c = read(path)
        except ValueError:
            continue
        if isinstance(c, dict) and c.get('url'):
            captures.setdefault(norm(c['url']), []).append({**c, 'receipt': str(path.relative_to(ws))})
    return captures


def watchable(caps):
    """The capture that allows a watch, or (None, reason). A watch on a URL that plain HTTP cannot read would only
    produce access-gap packages (monitor noise rules, 2026-11-06)."""
    if not caps:
        return None, 'no_capture_receipt'
    for c in caps:
        if str(c.get('status')) != '200':
            continue
        plain = str(c.get('plainHttpStatus') or '200')
        if c.get('hashKind') == 'rendered_dom' and plain != '200':
            continue
        return c, None
    rendered = [c for c in caps if c.get('hashKind') == 'rendered_dom']
    if rendered:
        return None, 'rendered_only_plain_http_' + str(rendered[0].get('plainHttpStatus'))
    return None, 'capture_status_' + '/'.join(sorted({str(c.get('status')) for c in caps}))


def build(ws, batch, edir):
    """Freeze the additive payload from parent/ + live-api/ + the workspace bundles and captures."""
    ws, parent_dir = Path(ws), edir / 'parent'
    live_receipt = read(edir / 'live-api' / 'receipt.json')
    cid, revision = batch['contentId'], batch['revision']
    key = note_key(cid)
    parent = read(parent_dir / 'sources.json')
    parent_bindings = read(parent_dir / 'watch-bindings.json')
    resolutions = read(parent_dir / 'source-resolutions.json')
    policy = read(parent_dir / 'fetch-policy.json')
    if parent['schoolCount'] != len(parent['schools']) or len(parent['sources']) != len(parent_bindings):
        raise Refused('Parent monitor state is inconsistent (schoolCount or bindings)')
    plan = json.loads(json.dumps(parent))
    by_norm = {}
    for src in plan['sources']:
        for u in (src['url'], src.get('originalUrl')):
            if u:
                by_norm.setdefault(norm(u), src)
    by_url = {src['url']: src for src in plan['sources']}
    resolved = {}
    for old_url, r in resolutions.items():
        target = by_url.get(r.get('newUrl') or '')
        resolved[norm(old_url)] = (target, r.get('status') or r.get('action') or 'resolved')
    single = {norm(u) for u in policy.get('singleAttemptUrls', [])}
    ids = {s['id'] for s in plan['sources']}
    enrolled = {s['slug']: s for s in plan['schools']}
    captures = load_captures(ws)
    salt = cid + '|'
    enrolled_at = live_receipt['fetchedAt'][:10]
    holds = (batch.get('openclaw') or {}).get('unboundClaims') or {}

    coverage, added_urls, reused, skipped_all, unbound_held, rendered_only = [], [], [], [], [], []
    new_schools, updated, baselines, problems = [], [], {}, []
    appended = 0
    for s in batch['schools']:
        slug = s['slug']
        raw = (edir / 'live-api' / f'{slug}.json').read_bytes()
        live = json.loads(raw)
        data = live['data']
        public_ids = [c['id'] for c in data['claims']]
        ctype = {c['id']: c['claimType'] for c in data['claims']}
        school = enrolled.get(slug)
        if school is not None:
            base_path = parent_dir / 'baseline' / f'{slug}.json'
            if not base_path.is_file() or sha(base_path) != school['baselineApiSha256']:
                problems.append(f'{slug}: enrolled, but its host baseline is missing or differs from baselineApiSha256')
                continue
            if read(base_path)['data'] != data or sorted(school['claimIds']) != sorted(public_ids):
                problems.append(f'{slug}: public data differs from the monitor baseline; a baseline refresh is separate '
                                'monitor maintenance (never overwritten by an enrollment)')
                continue
        bundle = read(ws / slug / 'bundle/outputs/bundle.json')
        rows = {}

        def row(url):
            return rows.setdefault(norm(url), {'url': url, 'claimIds': set(), 'refs': [], 'bundle': None,
                                               'official': None, 'cited': False})
        for i, c in enumerate(data['claims']):
            for j, e in enumerate(c['evidence']):
                r = row(e['sourceUrl']); r['claimIds'].add(c['id']); r['cited'] = True
                r['refs'].append({'kind': 'public_baseline_evidence', 'recordKey': f'$/claims/{i}/evidence/{j}',
                                  'sourceUrl': e['sourceUrl']})
                att = (e.get('attribution') or {}).get('sourceUrl')
                if att and norm(att) != norm(e['sourceUrl']):
                    r2 = row(att); r2['claimIds'].add(c['id']); r2['cited'] = True
                    r2['refs'].append({'kind': 'public_baseline_evidence',
                                       'recordKey': f'$/claims/{i}/evidence/{j}/attribution/sourceUrl', 'sourceUrl': att})
        for o in data['officialSources']:
            r = row(o['sourceUrl']); r['official'] = o
            r['refs'].append({'kind': 'public_official_source', 'recordKey': '$/officialSources/' + o['id'],
                              'sourceUrl': o['sourceUrl']})
        ev_url = {e['evidenceId']: e['sourceUrl'] for e in bundle['evidenceBindings']}
        for k, bs in enumerate(bundle['sources']):
            r = row(bs['url']); r['bundle'] = bs; r['cited'] = True
            r['refs'].append({'kind': 'published_v6_bundle_source', 'recordKey': f'$/sources/{k}', 'sourceUrl': bs['url'],
                              'bundleSourceId': bs['sourceId'], 'rawSha256': bs['rawSha256'], 'publishedContentId': cid})
        for pc in bundle['publicClaims']:
            if pc['claimId'] not in public_ids:
                problems.append(f"{slug}: bundle claim {pc['claimId']} is not a live public Claim ID")
            for eid in pc.get('evidenceIds', []):
                rows[norm(ev_url[eid])]['claimIds'].add(pc['claimId'])

        bound = {i for src in plan['sources'] for b in src['bindings']
                 if b['slug'] == slug and not b.get('candidateOnly') for i in b['claimIds']}
        school_sources, new_here, reused_here, gaps = set(), [], [], []
        for nkey, r in sorted(rows.items(), key=lambda kv: kv[1]['url']):
            claim_ids = [i for i in public_ids if i in r['claimIds']]

            def skip(reason):
                item = {'slug': slug, 'url': r['url'], 'reason': reason,
                        'captureReceipts': [c['receipt'] for c in captures.get(nkey, [])],
                        'captureStatus': [str(c.get('status')) for c in captures.get(nkey, [])],
                        'referenceKinds': sorted({ref['kind'] for ref in r['refs']}), 'claimIdsCitingIt': claim_ids}
                gaps.append(item); skipped_all.append(item)
            if not r['url'].startswith(('https://', 'http://')):
                skip('not_http'); continue
            if self_site(r['url']):
                skip('self_site'); continue
            existing = by_norm.get(nkey)
            if existing is None and nkey in resolved:
                existing, how = resolved[nkey]
                if existing is None:
                    skip('source_resolution_' + how); continue
            if existing is None and nkey in single:
                skip('ten_day_control_without_source'); continue
            cap, reason = watchable(captures.get(nkey, []))
            if cap is None:
                skip(reason); continue
            if cap.get('hashKind') == 'rendered_dom':
                rendered_only.append({'slug': slug, 'url': r['url'], 'captureReceipt': cap['receipt']})
            b, o = r['bundle'], r['official']
            if b:
                source_id, title, snap, at = b['sourceId'], b['title'], b['rawSha256'], b['retrievedAt']
            else:
                source_id = o['id'] if o else 'ref-' + sha_bytes((slug + '|' + r['url']).encode())[:20]
                title = (o or {}).get('citationTitle') or 'Public baseline source'
                snap, at = cap.get('rawSha256'), cap.get('retrievedAt')
            binding = {'slug': slug, 'sourceId': source_id, 'title': title, 'claimIds': claim_ids,
                       'claimTypes': sorted({ctype[i] for i in claim_ids}), 'snapshotHash': snap, 'retrievedAt': at,
                       'publishedContentId': cid, 'captureReceipt': cap['receipt'], 'supplementaryReferences': r['refs']}
            if existing is not None:
                mine = [x for x in existing['bindings'] if x['slug'] == slug and not x.get('candidateOnly')]
                covered = {i for x in mine for i in x['claimIds']}
                if not any(x['sourceId'] == source_id for x in existing['bindings'] if x['slug'] == slug):
                    existing['bindings'].append(binding); appended += 1
                elif not set(claim_ids) <= covered:
                    binding['sourceId'] = 'v6:' + cid + ':' + source_id
                    existing['bindings'].append(binding); appended += 1
                reused_here.append(existing['url']); school_sources.add(existing['id'])
                reused.append({'slug': slug, 'url': r['url'], 'sourceId': existing['id'], 'watchUrl': existing['url']})
            else:
                sid = 'src-' + sha_bytes(r['url'].encode())[:20]
                if sid in ids:
                    sid = 'src-' + sha_bytes((salt + r['url']).encode())[:20]
                if sid in ids:
                    raise Refused('Source id collision for ' + r['url'])
                ids.add(sid)
                src = {'id': sid, 'url': r['url'], 'bindings': [binding], 'intervalDays': 3 if r['cited'] else 7,
                       'official': True}
                plan['sources'].append(src); by_norm[nkey] = src; by_url[r['url']] = src
                new_here.append(r['url']); school_sources.add(sid); added_urls.append(r['url'])
            bound |= set(claim_ids)
        remaining = [i for i in public_ids if i not in bound]
        for claim_id in remaining:
            if holds.get(claim_id):
                unbound_held.append({'slug': slug, 'claimId': claim_id, 'reason': holds[claim_id]})
            else:
                problems.append(f'{slug}: public Claim ID {claim_id} has no watchable source '
                                '(record a reason in batch.json openclaw.unboundClaims to hold it)')
        record_sha = (live.get('recordRevision') or {}).get('recordSha256')
        if school is None:
            new_schools.append(slug); baselines[slug] = raw
            plan['schools'].append({
                'slug': slug, 'claimIds': public_ids, 'baselineApiSha256': sha_bytes(raw), 'reviewState': 'agent_reviewed',
                'enrollmentScope': 'public_published_v6', 'sourcePublishedV6': True, 'publicationApproved': False,
                'candidateOnly': False, 'publishedContentId': cid, 'localViewRevision': revision,
                'publishedRecordSha256': record_sha, 'sourceCount': len(school_sources),
                'publicClaimCount': len(public_ids), 'enrolledAt': enrolled_at})
            kind = 'new_school'
        elif (school.get('publishedContentId'), school.get('localViewRevision')) != (cid, revision):
            updated.append(slug)
            history = list(school.get('localViewRevisionHistory') or [])
            for rev in (school.get('previousLocalViewRevision'), school.get('localViewRevision')):
                if rev and rev not in history and rev != revision:
                    history.append(rev)
            school.update({'localViewRevisionHistory': history,
                           'previousLocalViewRevision': school.get('localViewRevision'),
                           'previousPublishedContentId': school.get('publishedContentId'),
                           'publishedContentId': cid, 'localViewRevision': revision, 'sourcePublishedV6': True,
                           'candidateOnly': False, 'publicationApproved': False, 'publishedRecordSha256': record_sha})
            kind = 'status_update'
        else:
            kind = 'unchanged'
        coverage.append({'slug': slug, 'enrollment': kind, 'publicClaimIds': public_ids, 'publicClaimCount': len(public_ids),
                         'sourceCount': len(school_sources), 'newSourceUrls': sorted(new_here),
                         'reusedSourceUrls': sorted(set(reused_here)),
                         'remainingPublicClaimIdsWithoutWatchBinding': remaining, 'skippedUrls': gaps,
                         'publishedContentId': cid, 'publicationApproved': False, 'baselineApiSha256': sha_bytes(raw)})
    if problems:
        raise Refused('Build refused: ' + ' | '.join(problems[:8]) + (f' (+{len(problems) - 8} more)' if len(problems) > 8 else ''))

    summary = {'schools': len(batch['schools']), 'newSchools': len(new_schools), 'statusUpdated': len(updated),
               'addedWatches': len(added_urls), 'appendedBindings': appended, 'skippedUrls': len(skipped_all),
               'unboundClaimsHeld': len(unbound_held), 'renderedOnlyWatches': len(rendered_only)}
    if not (new_schools or updated or added_urls or appended):
        return dict(summary, status='nothing_to_enroll', payloadManifestSha256=None,
                    coverage={'universities': coverage, 'skippedUrls': skipped_all})
    if key in parent:
        raise Refused(f'{cid} was enrolled before ({key}) and the monitor still misses part of it; inspect the host '
                      'receipts of that enrollment (a page update needs its own contentId)')
    plan['schoolCount'] = len(plan['schools'])
    plan[key] = {
        'publishedContentId': cid, 'viewRevision': revision, 'batchId': batch['batchId'], 'mode': batch['mode'],
        'newSchools': new_schools, 'statusUpdatedSchools': updated,
        'parentSourcesSha256': sha(parent_dir / 'sources.json'),
        'parentWatchBindingsSha256': sha(parent_dir / 'watch-bindings.json'),
        'previousSourceCount': len(parent['sources']), 'addedSourceCount': len(added_urls),
        'appendedBindingCount': appended, 'sourceCount': len(plan['sources']),
        'skippedUrls': [{'slug': x['slug'], 'url': x['url'], 'reason': x['reason']} for x in skipped_all],
        'note': ('Additive enrollment (scripts/v6-pipeline/openclaw_enroll.py) of the V6 pages published in ' + cid +
                 '. Existing watches, controls and baselines unchanged; skippedUrls are not watched. '
                 'Enrollment is not retrieval success, policy approval or publication approval.'),
        'publicationApproved': False}
    meta = {'schemaVersion': 'uapt-v6-openclaw-enrollment-v1', 'publishedContentId': cid, 'viewRevision': revision,
            'batchId': batch['batchId'], 'mode': batch['mode'], 'noteKey': key, 'newSchools': new_schools,
            'batchSchools': [s['slug'] for s in batch['schools']],
            'statusUpdatedSchools': updated, 'parentSchoolCount': len(parent['schools']),
            'parentWatchCount': len(parent['sources']), 'appendedBindings': appended, 'publicationApproved': False}
    cov = {'schoolCount': plan['schoolCount'], 'previousWatchCount': len(parent_bindings),
           'plannedWatchCount': len(plan['sources']), 'addedUrls': sorted(added_urls), 'reusedBindings': reused,
           'skippedUrls': skipped_all, 'unboundClaims': unbound_held, 'renderedOnlyWatches': rendered_only,
           'publishedContentId': cid, 'publicClaimCount': sum(u['publicClaimCount'] for u in coverage),
           'liveApi': {slug: {k: v for k, v in r.items() if k != 'claimIds'} for slug, r in live_receipt['schools'].items()},
           'universities': coverage, 'publicationApproved': False}
    out = edir / 'payload'  # replaced only when there is something to enroll (an installed payload stays for readback)
    if out.exists():
        shutil.rmtree(out)
    for stale in (edir / 'install.py', edir / 'payload-manifest.json'):
        if stale.exists():
            stale.unlink()
    (out / 'baseline').mkdir(parents=True)
    (out / 'sources.json').write_text(dump(plan))
    (out / 'coverage.json').write_text(dump(cov))
    (out / 'enrollment.json').write_text(dump(meta))
    for slug, raw in baselines.items():
        (out / 'baseline' / f'{slug}.json').write_bytes(raw)
    shutil.copyfile(INSTALLER, edir / 'install.py')
    files = {str(p.relative_to(edir)): sha(p) for p in sorted(out.rglob('*')) if p.is_file()}
    files['install.py'] = sha(edir / 'install.py')
    manifest = {'schemaVersion': PAYLOAD_SCHEMA, 'files': files,
                'parentFiles': {n: sha(parent_dir / n) for n in PARENT_FILES},
                'parentBaselines': {f'baseline/{slug}.json': sha(parent_dir / 'baseline' / f'{slug}.json') for slug in updated},
                'publicationApproved': False}
    (edir / 'payload-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return dict(summary, status='payload_ready', payloadManifestSha256=sha(edir / 'payload-manifest.json'))


# ---------------------------------------------------------------- host steps

def payload_tar(edir):
    """payload-manifest.json + every manifest file, as an uncompressed tar with no macOS metadata (AppleDouble rule)."""
    manifest = read(edir / 'payload-manifest.json')
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w', format=tarfile.PAX_FORMAT) as tar:
        for relative in ['payload-manifest.json'] + sorted(manifest['files']):
            raw = (edir / relative).read_bytes()
            info = tarfile.TarInfo(relative); info.size = len(raw); info.mode = 0o600; info.mtime = 0
            tar.addfile(info, io.BytesIO(raw))
    return buf.getvalue()


def verify_local(edir):
    manifest = read(edir / 'payload-manifest.json')
    for relative, expected in manifest['files'].items():
        if sha(edir / relative) != expected:
            raise Refused('Local payload changed since build: ' + relative + ' (rebuild)')
    return sha(edir / 'payload-manifest.json')


def host_json(code, out, err, what):
    try:
        value = json.loads(out.decode('utf-8').strip().splitlines()[-1])
    except (ValueError, IndexError):
        raise Refused(f'{what} failed (exit {code}): {err.strip()[-400:]}')
    if code or not value.get('ok'):
        raise Refused(f"{what} refused on the host: {value.get('refused') or err.strip()[-400:]}")
    return value


def target_dir(remote, cid):
    return remote.base.rstrip('/') + '/enrollment-' + cid


def dry_run(edir, remote):
    verify_local(edir)
    command = ('d=$(mktemp -d); trap \'rm -rf "$d"\' EXIT; tar -x -C "$d" -f -; '
               f'python3 "$d/install.py" dry-run --here "$d" --base {shlex.quote(remote.base)}')
    value = host_json(*remote(command, stdin=payload_tar(edir), timeout=600), 'dry-run')
    (edir / 'host').mkdir(exist_ok=True)
    (edir / 'host' / 'dry-run.json').write_text(json.dumps(value, indent=1) + '\n')
    return value


def install(edir, remote, approved, authorization):
    manifest_sha = verify_local(edir)
    if not HEX64.match(approved or '') or approved != manifest_sha:
        raise Refused(f'--approve must be the approved payload-manifest.json SHA256 ({manifest_sha})')
    if not authorization.strip():
        raise Refused('--authorization must quote the owner go-ahead for this enrollment')
    if not (edir / 'host' / 'dry-run.json').is_file() or read(edir / 'host' / 'dry-run.json').get('manifestSha256') != manifest_sha:
        raise Refused('Run dry-run on this payload first')
    target = shlex.quote(target_dir(remote, read(edir / 'payload/enrollment.json')['publishedContentId']))
    auth = base64.b64encode(authorization.encode('utf-8')).decode()
    command = ('d=$(mktemp -d); trap \'rm -rf "$d"\' EXIT; tar -x -C "$d" -f -; '
               f'python3 "$d/install.py" stage --here "$d" --base {shlex.quote(remote.base)} --target {target} >/dev/null; '
               f'python3 {target}/install.py install --base {shlex.quote(remote.base)} --approved-sha256 {approved} '
               f'--authorization-b64 {auth}')
    value = host_json(*remote(command, stdin=payload_tar(edir), timeout=3600), 'install')
    receipts = host_json(*remote(f'python3 {target}/install.py receipts', timeout=120), 'receipts')
    (edir / 'host').mkdir(exist_ok=True)
    for name in ('before.json', 'creation-journal.json', 'installed.json'):
        if name in receipts:
            (edir / 'host' / name).write_text(json.dumps(receipts[name], ensure_ascii=False, indent=1) + '\n')
    return value


def readback(edir, remote):
    target = shlex.quote(target_dir(remote, read(edir / 'payload/enrollment.json')['publishedContentId']))
    value = host_json(*remote(f'python3 {target}/install.py readback --base {shlex.quote(remote.base)}', timeout=600), 'readback')
    (edir / 'host').mkdir(exist_ok=True)
    (edir / 'host' / 'readback.json').write_text(json.dumps(value, indent=1) + '\n')
    problems = [k for k, ok in (('sourcesMatchPayload', value['sourcesMatchPayload']),
                                ('previousControlsIdentical', value['previousControlsIdentical'] == value['previousWatchCount']),
                                ('newWatchesInBindings', value['newWatchesInBindings'] == value['createdCount']),
                                ('journalActivated', value['journalActivated']),
                                ('apiWatchCount', value['apiWatchCount'] == value['bindingsCount'] == value['sourcesCount']),
                                ('baselinesMatchPayload', value['baselinesMatchPayload'])) if not ok]
    return dict(value, problems=problems)


# ---------------------------------------------------------------- entry

def plan_step(ws, batch, edir, args, remote_factory, reader=None):
    live = fetch_live(ws, batch, edir, args.public_base, reader=reader, refresh=args.refresh_live)
    parent = fetch_parent(ws, batch, edir, remote_factory(), refresh=args.refresh_parent)
    result = build(ws, batch, edir)
    result.pop('coverage', None)
    nxt = ('Nothing to enroll: every source and school is already in the monitor.' if result['status'] == 'nothing_to_enroll'
           else 'Read payload/coverage.json, then: v6:openclaw-enroll dry-run; the owner approves payloadManifestSha256 '
                'once; then install --approve <sha> --authorization "<quote>"; then readback.')
    receipt(edir, 'plan', status=result['status'], next=nxt, payloadManifestSha256=result['payloadManifestSha256'],
            summary={k: v for k, v in result.items() if k not in ('status', 'payloadManifestSha256')},
            liveApiFetchedAt=live['fetchedAt'], parentFetchedAt=parent['fetchedAt'], parentFiles=parent['files'])
    return dict(result, next=nxt)


def main(argv=None, remote_factory=None, reader=None):
    ws, rest = B.workspace_from_argv(argv)
    p = argparse.ArgumentParser(prog='v6:openclaw-enroll')
    p.add_argument('step', nargs='?', default='plan', choices=['plan', 'dry-run', 'install', 'readback', 'status'])
    p.add_argument('--approve'); p.add_argument('--authorization', default='')
    p.add_argument('--refresh-live', action='store_true'); p.add_argument('--refresh-parent', action='store_true')
    p.add_argument('--public-base', default=DEFAULT_PUBLIC); p.add_argument('--env-file')
    args = p.parse_args(rest)
    batch = B.load(ws)
    edir = enrollment_dir(ws, batch)
    remote_factory = remote_factory or (lambda: Remote(host_config(args.env_file)))
    if args.step == 'status':
        result = read(edir / 'receipt.json') if (edir / 'receipt.json').is_file() else {'status': 'not_started'}
    elif args.step == 'plan':
        result = plan_step(ws, batch, edir, args, remote_factory, reader)
    elif args.step == 'dry-run':
        value = dry_run(edir, remote_factory())
        result = {'status': 'dry_run_passed', 'next': 'Owner approval of payloadManifestSha256, then install.', **value}
        receipt(edir, 'dry-run', status='dry_run_passed', next=result['next'], payloadManifestSha256=value['manifestSha256'],
                plannedNewWatches=value['plannedNewWatches'], liveWatchCount=value['liveWatchCount'])
    elif args.step == 'install':
        value = install(edir, remote_factory(), args.approve, args.authorization)
        status = 'already_installed' if value.get('alreadyInstalled') else 'installed'
        result = {'status': status, 'next': 'readback', **{k: v for k, v in value.items() if k != 'createdWatchIds'}}
        receipt(edir, 'install', status=status, next='readback', payloadManifestSha256=args.approve,
                authorization=args.authorization, newWatches=value['newWatches'], watchCount=value['watchCount'])
    else:
        value = readback(edir, remote_factory())
        status = 'complete' if not value['problems'] else 'readback_failed'
        nxt = ('Record the counts in the batch RESULT.md and the OpenClaw docs (UAPT_DEDICATED_MONITOR, AGENTS.md).'
               if status == 'complete' else 'Inspect host/readback.json: ' + ', '.join(value['problems']))
        result = {'status': status, 'next': nxt, **value}
        receipt(edir, 'readback', status=status, next=nxt, problems=value['problems'], watchCount=value['apiWatchCount'])
    print(json.dumps(result, ensure_ascii=False, indent=1))
    return 0 if result.get('status') not in ('readback_failed',) else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (Refused, B.BatchError) as error:
        print(json.dumps({'status': 'refused', 'error': str(error)}, ensure_ascii=False))
        sys.exit(2)
