#!/usr/bin/env python3
"""Host side of the V6 OpenClaw enrollment (S8b, docs/v6-pipeline.md §2.4). Runs on the OpenClaw host as `openclaw`.

  python3 install.py dry-run  [--base <monitor dir>]                 validate + GET the live watch list; prints JSON
  python3 install.py stage    --target <dir>                         copy this payload to <dir> (new or byte-equal)
  python3 install.py install  --approved-sha256 <sha> --authorization-b64 <b64> [--base <dir>]
  python3 install.py receipts                                        print this enrollment's receipts (JSON)
  python3 install.py readback [--base <dir>]                         GET-only readback after install; prints JSON

Built and copied next to payload/ by scripts/v6-pipeline/openclaw_enroll.py; payload-manifest.json pins every file.
Generalises the batch-3 install.py (2026-11-21) and its r2 follow-up: the constants now come from payload/enrollment.json.

Rules (unchanged from the hand-run enrollments since 2026-10-28):
- additive only: existing watch URLs, metadata, bindings, pauses, intervals, ten-day controls and baselines never change;
  appended bindings and new school groups are the only changes to sources.json; a status update touches only the
  STATUS_FIELDS of a school already enrolled;
- the parent files must still have the hashes the payload was built on (otherwise: rebuild, never merge by hand);
- new watches are created paused and muted, journaled, then unpaused; the native scheduler makes the first check;
- never the destructive `monitor_control.py import`; no restart, no sweep, no notification; publicationApproved stays false;
- dry-run and readback only GET the monitor API and read files; stdlib only, Python 3.8+.
"""
import argparse
import base64
import fcntl
import hashlib
import json
import os
import shutil
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
DEFAULT_BASE = Path('/home/openclaw/.local/share/uapt-monitor')
PARENT_FILES = ('sources.json', 'watch-bindings.json', 'source-resolutions.json', 'fetch-policy.json',
                'monitor_control.py', 'monitor_noise.py')
STATUS_FIELDS = {'sourcePublishedV6', 'candidateOnly', 'publishedContentId', 'localViewRevision',
                 'previousLocalViewRevision', 'previousPublishedContentId', 'localViewRevisionHistory',
                 'publishedRecordSha256', 'publicationApproved'}  # publicationApproved: may only be added as false
CONTROL_KEYS = ('url', 'paused', 'time_between_check', 'notification_muted')
WATCH_OPTIONS = {'fetch_backend': 'html_requests', 'subtractive_selectors': ['script', 'style', 'nav', 'footer'],
                 'trim_text_whitespace': True}
RECEIPTS = ('before.json', 'creation-journal.json', 'installed.json')


class Refused(Exception):
    pass


def check(condition, message):
    if not condition:
        raise Refused(message)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def load(path):
    return json.loads(Path(path).read_text())


def norm(url):
    p = urlsplit(url.strip())
    host = p.netloc.lower()
    host = host[4:] if host.startswith('www.') else host
    return (host, p.path.rstrip('/'), p.query)


def inside(path, root):
    path, root = os.path.realpath(str(path)), os.path.realpath(str(root))
    return os.path.commonpath([path, root]) == root


def monitor(base):
    """The host's own monitor_control (token handling, save serialisation, self-site rule)."""
    sys.path.insert(0, str(base))
    import monitor_control  # noqa: E402  (host module, not in the repository)
    return monitor_control


# ---------------------------------------------------------------- validation (no writes, no network)

def validate_payload(here, base, c):
    """Everything that can be checked from files. Returns (manifest, meta, plan, coverage, old bindings)."""
    here, base = Path(here), Path(base)
    manifest = load(here / 'payload-manifest.json')
    check(manifest.get('schemaVersion') == 'uapt-v6-openclaw-payload-v1', 'Unknown payload schema')
    for relative, expected in manifest['files'].items():
        path = here / relative
        check(inside(path, here) and path.is_file() and sha(path) == expected, 'Payload changed: ' + relative)
    for relative, expected in manifest['parentFiles'].items():
        check(sha(base / relative) == expected, 'Concurrent state change: ' + relative + ' (rebuild the payload)')
    for relative, expected in manifest.get('parentBaselines', {}).items():
        check(sha(base / relative) == expected, 'Concurrent state change: ' + relative + ' (rebuild the payload)')
    meta = load(here / 'payload/enrollment.json')
    plan = load(here / 'payload/sources.json')
    coverage = load(here / 'payload/coverage.json')
    parent = load(base / 'sources.json')
    old = load(base / 'watch-bindings.json')
    cid, note_key = meta['publishedContentId'], meta['noteKey']
    new, updated = meta['newSchools'], meta['statusUpdatedSchools']
    check(meta['publicationApproved'] is False and coverage['publicationApproved'] is False, 'publicationApproved must stay false')
    check(not set(new) & set(updated), 'A school is both new and status-updated')

    # Top level: everything kept except the school/source lists and counts, plus one new note block.
    for key, value in parent.items():
        if key not in ('schools', 'sources', 'schoolCount'):
            check(plan.get(key) == value, 'Top-level metadata changed: ' + key)
    check(set(plan) - set(parent) <= {note_key}, 'Unexpected top-level keys')
    check(note_key not in parent, 'Note block already exists: ' + note_key)
    note = plan[note_key]
    check(note['publicationApproved'] is False and note['publishedContentId'] == cid, 'Note block scope')
    check(parent['schoolCount'] == len(parent['schools']) == meta['parentSchoolCount'], 'Parent school count differs')
    check(len(parent['sources']) == len(old) == meta['parentWatchCount'], 'Parent watch count differs')

    # Schools: parent order kept; only planned status fields change; new groups appended.
    previous = {s['slug']: s for s in parent['schools']}
    check(set(updated) <= set(previous), 'Status update for a school that is not enrolled')
    check(not set(new) & set(previous), 'New school is already enrolled')
    check(plan['schoolCount'] == len(plan['schools']) == len(parent['schools']) + len(new), 'School count')
    check([s['slug'] for s in plan['schools'][:len(parent['schools'])]] == [s['slug'] for s in parent['schools']],
          'Existing school order changed')
    check([s['slug'] for s in plan['schools'][len(parent['schools']):]] == new, 'New school list differs')
    for school in plan['schools'][:len(parent['schools'])]:
        before = previous[school['slug']]
        if school['slug'] not in updated:
            check(school == before, 'Unplanned school change: ' + school['slug'])
            continue
        for key in set(before) | set(school):
            if key not in STATUS_FIELDS:
                check(school.get(key) == before.get(key), 'School field changed: ' + key)
        check(school['publishedContentId'] == cid and school.get('publicationApproved') is False, 'Status update scope')
        check(school['sourcePublishedV6'] is True and school['candidateOnly'] is False, 'Status update scope')
        for rev in (before.get('previousLocalViewRevision'), before.get('localViewRevision')):
            check(rev is None or rev == school['localViewRevision'] or rev in school.get('localViewRevisionHistory', []),
                  'View revision history lost')
    for school in plan['schools'][len(parent['schools']):]:
        check(school['sourcePublishedV6'] is True and school['publicationApproved'] is False, 'New school scope')
        check(school['candidateOnly'] is False and school['reviewState'] == 'agent_reviewed', 'New school scope')
        check(school['publishedContentId'] == cid, 'New school content id')

    # Sources: every old source kept with unchanged url, metadata and bindings prefix.
    check(len({s['id'] for s in plan['sources']}) == len(plan['sources']), 'Duplicate source id')
    by_id = {s['id']: s for s in plan['sources']}
    check([s['id'] for s in plan['sources'][:len(parent['sources'])]] == [s['id'] for s in parent['sources']],
          'Existing source order changed')
    check({s['id'] for s in old.values()} == {s['id'] for s in parent['sources']}, 'Bindings and sources disagree')
    policy = load(base / 'fetch-policy.json')
    protected = set(policy.get('singleAttemptWatchIds', []))
    batch = set(meta['batchSchools'])
    check(set(new) | set(updated) <= batch, 'Updated schools outside the batch')
    appended = 0
    for uid, before in old.items():
        after = by_id[before['id']]
        check(after['url'] == before['url'], 'Unexpected URL change')
        check(set(after) == set(before), 'Existing source top-level fields changed')
        for key, value in before.items():
            if key != 'bindings':
                check(after.get(key) == value, 'Existing source metadata changed: ' + key)
        check(after['bindings'][:len(before['bindings'])] == before['bindings'], 'Existing binding changed')
        for binding in after['bindings'][len(before['bindings']):]:
            appended += 1
            check(binding['slug'] in batch and binding.get('publishedContentId') == cid, 'Appended binding scope')
            check(binding.get('captureReceipt'), 'Appended binding without a 200 capture receipt')
        if before.get('singleAttempt') or uid in protected:
            check(after.get('singleAttempt') == before.get('singleAttempt')
                  and after['intervalDays'] == before['intervalDays'], 'Ten-day control changed')
    check(appended == meta['appendedBindings'], 'Appended binding count differs')
    known = set()
    for s in parent['sources']:
        known.add(norm(s['url']))
        if s.get('originalUrl'):
            known.add(norm(s['originalUrl']))
    resolved = {norm(u) for u in load(base / 'source-resolutions.json')}
    single = {norm(u) for u in policy.get('singleAttemptUrls', [])}
    new_sources = plan['sources'][len(parent['sources']):]
    check(len({norm(s['url']) for s in new_sources}) == len(new_sources), 'Duplicate new URL')
    for s in new_sources:
        check(norm(s['url']) not in known, 'New watch duplicates an existing URL')
        check(norm(s['url']) not in resolved, 'New watch revives a resolved source')
        check(norm(s['url']) not in single, 'New watch duplicates a ten-day control')
        check(s['official'] is True and s['intervalDays'] in (3, 7) and not s.get('singleAttempt'), 'New watch controls')
        check(set(s) == {'id', 'url', 'bindings', 'intervalDays', 'official'}, 'New watch fields')
        check(not c.is_self_site(s['url']), 'Self-site URL')
        check(s['url'].startswith(('https://', 'http://')), 'Not an http(s) URL')
        for b in s['bindings']:
            check(b.get('publishedContentId') == cid and b['slug'] in batch, 'New watch binding scope')
            check(b.get('captureReceipt'), 'New watch without a 200 capture receipt')
    check(sorted(s['url'] for s in new_sources) == coverage['addedUrls'], 'Added URLs differ from coverage')
    skipped = {norm(x['url']) for x in coverage['skippedUrls']}
    check(not skipped & {norm(s['url']) for s in new_sources}, 'Skipped URL scheduled as a watch')
    old_bindings = {before['id']: len(before['bindings']) for before in old.values()}
    check(not skipped & {norm(s['url']) for s in plan['sources'] for b in s['bindings'][old_bindings.get(s['id'], 0):]
                         if b.get('publishedContentId') == cid}, 'Skipped URL bound')

    # Claim scope: only public Claim IDs; every public Claim ID of the batch is bound (or held with a reason).
    held = {h['claimId'] for h in coverage.get('unboundClaims', [])}
    for slug in new + updated:
        school = next(s for s in plan['schools'] if s['slug'] == slug)
        if slug in new:
            path = here / 'payload/baseline' / (slug + '.json')
            check(not (base / 'baseline' / path.name).exists(), 'Existing baseline must not be overwritten: ' + slug)
            check(sha(path) == school['baselineApiSha256'], 'Baseline hash differs: ' + slug)
            public_ids = {x['id'] for x in load(path)['data']['claims']}
        else:
            path = base / 'baseline' / (slug + '.json')
            check(path.is_file() and sha(path) == school['baselineApiSha256'], 'Existing baseline differs: ' + slug)
            public_ids = {x['id'] for x in load(path)['data']['claims']}
        check(set(school['claimIds']) == public_ids, 'School Claim IDs differ from its baseline: ' + slug)
        new_bound = {i for s in plan['sources'] for b in s['bindings']
                     if b['slug'] == slug and b.get('publishedContentId') == cid for i in b['claimIds']}
        check(new_bound <= public_ids, 'Non-public Claim IDs in source bindings: ' + slug)
        bound = {i for s in plan['sources'] for b in s['bindings']
                 if b['slug'] == slug and not b.get('candidateOnly') for i in b['claimIds']}
        check(public_ids - bound <= held, 'Public Claim IDs missing a binding: ' + slug)
    return manifest, meta, plan, coverage, old


def live_checks(base, c, plan, old, meta):
    watches = c.api('watch')
    check(set(old) == set(watches), 'Unclassified existing watches (watch-bindings.json and the live API differ)')
    for uid, w in watches.items():
        check(w['url'] == old[uid]['url'], 'Live watch URL differs from bindings: ' + uid)
    live_norm = {norm(w['url']) for w in watches.values()}
    new_sources = plan['sources'][meta['parentWatchCount']:]
    clash = [s['url'] for s in new_sources if norm(s['url']) in live_norm]
    check(not clash, 'New URL already watched: ' + repr(clash[:5]))
    return watches


def watch_controls(base, uids):
    out = {}
    for uid in uids:
        path = Path(base) / 'data' / uid / 'watch.json'
        watch = load(path) if path.is_file() else {}
        out[uid] = {k: watch.get(k) for k in CONTROL_KEYS}
    return out


# ---------------------------------------------------------------- commands

def cmd_dry_run(here, base, c):
    manifest, meta, plan, coverage, old = validate_payload(here, base, c)
    watches = live_checks(base, c, plan, old, meta)
    tags = {v['title'] for v in c.api('tags').values()}
    controls = watch_controls(base, old)
    return {'valid': True, 'checkedAt': time.time(), 'manifestSha256': sha(Path(here) / 'payload-manifest.json'),
            'publishedContentId': meta['publishedContentId'], 'liveWatchCount': len(watches),
            'plannedWatchCount': len(plan['sources']), 'plannedNewWatches': len(plan['sources']) - len(old),
            'appendedBindings': meta['appendedBindings'], 'plannedSchoolCount': plan['schoolCount'],
            'newSchools': meta['newSchools'], 'statusUpdatedSchools': meta['statusUpdatedSchools'],
            'skippedUrls': len(coverage['skippedUrls']),
            'tagsToCreate': [s for s in meta['newSchools'] + meta['statusUpdatedSchools'] if s not in tags],
            'pausedExistingWatches': sum(bool(v['paused']) for v in controls.values()),
            'protectedTenDay': len(load(Path(base) / 'fetch-policy.json').get('singleAttemptWatchIds', [])),
            'parentFiles': manifest['parentFiles'], 'publicationApproved': False}


def cmd_stage(here, target):
    """Copy this payload to the enrollment folder: create it, or accept a byte-identical copy (idempotent)."""
    target = Path(target)
    files = ['payload-manifest.json'] + list(load(Path(here) / 'payload-manifest.json')['files'])
    if target.exists():
        check((target / 'payload-manifest.json').is_file()
              and sha(target / 'payload-manifest.json') == sha(Path(here) / 'payload-manifest.json'),
              'Another payload is staged in ' + str(target) + '; inspect it, never overwrite')
        return {'staged': str(target), 'created': False}
    temporary = target.with_name(target.name + '.staging')
    check(not temporary.exists(), 'Leftover staging folder ' + str(temporary) + '; inspect it first')
    for relative in files:
        destination = temporary / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(Path(here) / relative, destination)
    os.chmod(str(temporary), 0o700)
    os.rename(str(temporary), str(target))
    return {'staged': str(target), 'created': True}


def cmd_install(here, base, c, approved, authorization):
    here, base = Path(here), Path(base)
    manifest_sha = sha(here / 'payload-manifest.json')
    check(approved == manifest_sha, 'The approved SHA256 is not this payload-manifest.json (' + manifest_sha + ')')
    check(authorization.strip(), 'Quote the owner authorization')
    if (here / 'installed.json').is_file():
        installed = load(here / 'installed.json')
        return dict(installed, alreadyInstalled=True,
                    sourcesChangedSince=sha(base / 'sources.json') != installed['sourceManifestSha256'])
    journal = here / 'creation-journal.json'
    check(not journal.exists(), 'A previous install stopped part-way (creation-journal.json); recover by hand from the journal')
    manifest, meta, plan, coverage, old = validate_payload(here, base, c)
    watches = live_checks(base, c, plan, old, meta)
    policy_before = (base / 'fetch-policy.json').read_bytes()
    controls = watch_controls(base, old)
    c.save(here / 'before.json', {'capturedAt': time.time(), 'parentFiles': manifest['parentFiles'],
                                  'watchControls': controls})
    tags = {v['title']: uid for uid, v in c.api('tags').items()}
    created_tags = []
    for slug in meta['newSchools'] + meta['statusUpdatedSchools']:
        if slug not in tags:
            tags[slug] = c.api('tag', 'POST', {'title': slug, 'notification_muted': True})['uuid']
            created_tags.append(slug)
    existing_by_id = {b['id']: uid for uid, b in old.items()}
    by_url = {w['url']: uid for uid, w in watches.items()}
    bindings, created, tag_changes = {}, [], []
    c.save(journal, {'createdWatchIds': created, 'activated': False})
    old_counts = {b['id']: len(b['bindings']) for b in old.values()}
    for source in plan['sources']:
        uid = existing_by_id.get(source['id'])
        added = source['bindings'][old_counts.get(source['id'], 0):]  # only this payload's bindings carry tags
        school_tags = {tags[b['slug']] for b in added if b['slug'] in tags}
        if uid is None:
            check(source['url'] not in by_url, 'Duplicate new watch URL')
            body = dict(WATCH_OPTIONS, url=source['url'], title=' / '.join(sorted({b['slug'] for b in source['bindings']})),
                        paused=True, notification_muted=True, tags=sorted(school_tags),
                        time_between_check_use_default=False, time_between_check={'days': source['intervalDays']})
            uid = c.api('watch', 'POST', body)['uuid']
            created.append(uid)
            c.save(journal, {'createdWatchIds': created, 'activated': False})
            by_url[source['url']] = uid
        else:
            current = set(watches[uid].get('tags', []))
            if not school_tags <= current:
                tag_changes.append((uid, sorted(current | school_tags)))
        bindings[uid] = source
    check(len(bindings) == len(plan['sources']) and set(old) <= set(bindings), 'Binding map incomplete')
    for path in sorted((here / 'payload/baseline').glob('*.json')):
        target = base / 'baseline' / path.name
        check(not target.exists(), 'Existing school baseline must not be overwritten')
        temporary = target.with_suffix('.enrollment.tmp')
        shutil.copyfile(str(path), str(temporary))
        os.replace(str(temporary), str(target))
    temporary = base / 'sources.enrollment.tmp'  # byte copy: installed hash == payload hash
    shutil.copyfile(str(here / 'payload/sources.json'), str(temporary))
    os.replace(str(temporary), str(base / 'sources.json'))
    c.save(base / 'watch-bindings.json', bindings)
    for uid, tag_ids in tag_changes:  # tags only; url, pause and interval are never sent for an existing watch
        c.api('watch/' + uid, 'PUT', {'tags': tag_ids})
    for uid in created:
        c.api('watch/' + uid, 'PUT', {'paused': False})
    c.save(journal, {'createdWatchIds': created, 'activated': True})
    check((base / 'fetch-policy.json').read_bytes() == policy_before, 'fetch-policy.json changed')
    after = watch_controls(base, old)
    changed = [uid for uid, expected in controls.items() if after[uid] != expected]
    check(not changed, 'Existing watch control changed: ' + repr(changed[:5]))
    live = c.api('watch')
    check(set(live) == set(bindings), 'Watch set differs from bindings after install')
    result = {'completedAt': time.time(), 'manifestSha256': manifest_sha, 'authorization': authorization,
              'publishedContentId': meta['publishedContentId'], 'schoolCount': plan['schoolCount'],
              'newSchools': meta['newSchools'], 'statusUpdatedSchools': meta['statusUpdatedSchools'],
              'watchCount': len(live), 'newWatches': len(created), 'createdWatchIds': created,
              'appendedBindings': meta['appendedBindings'], 'createdTags': created_tags,
              'existingWatchTagAdditions': len(tag_changes), 'previousWatchIdsPreserved': len(old),
              'existingControlsUnchanged': True,
              'protectedTenDayControlsPreserved': len(load(base / 'fetch-policy.json').get('singleAttemptWatchIds', [])),
              'skippedUrls': len(coverage['skippedUrls']), 'unboundClaims': len(coverage.get('unboundClaims', [])),
              'sourceManifestSha256': sha(base / 'sources.json'), 'bindingsSha256': sha(base / 'watch-bindings.json'),
              'fetchPolicySha256': sha(base / 'fetch-policy.json'), 'controlSha256': sha(base / 'monitor_control.py'),
              'firstSweepComplete': False, 'publicationApproved': False}
    c.save(here / 'installed.json', result)
    return result


def cmd_receipts(here):
    return {name: load(Path(here) / name) for name in RECEIPTS if (Path(here) / name).is_file()}


def cmd_readback(here, base, c):
    here, base = Path(here), Path(base)
    meta = load(here / 'payload/enrollment.json')
    plan = load(base / 'sources.json')
    bindings = load(base / 'watch-bindings.json')
    before = load(here / 'before.json')['watchControls']
    journal = load(here / 'creation-journal.json')
    created = journal['createdWatchIds']
    live = c.api('watch')
    tag_title = {uid: v['title'] for uid, v in c.api('tags').items()}
    after = watch_controls(base, before)
    new = {uid: load(base / 'data' / uid / 'watch.json') for uid in created if (base / 'data' / uid / 'watch.json').is_file()}
    return {
        'apiWatchCount': len(live), 'bindingsCount': len(bindings), 'sourcesCount': len(plan['sources']),
        'schoolCount': plan['schoolCount'], 'sourcesSha256': sha(base / 'sources.json'),
        'payloadSourcesSha256': sha(here / 'payload/sources.json'),
        'sourcesMatchPayload': sha(base / 'sources.json') == sha(here / 'payload/sources.json'),
        'bindingsSha256': sha(base / 'watch-bindings.json'), 'fetchPolicySha256': sha(base / 'fetch-policy.json'),
        'createdCount': len(created), 'journalActivated': journal['activated'],
        'previousWatchIdsPresent': sum(uid in live for uid in before),
        'previousControlsIdentical': sum(after[uid] == before[uid] for uid in before), 'previousWatchCount': len(before),
        'newPaused': sum(bool(w.get('paused')) for w in new.values()),
        'newMuted': sum(bool(w.get('notification_muted')) for w in new.values()),
        'newIntervals': sorted({json.dumps({k: v for k, v in (w.get('time_between_check') or {}).items() if v})
                                for w in new.values()}),
        'newFetchBackend': sorted({str(w.get('fetch_backend')) for w in new.values()}),
        'newTagTitles': sorted({tag_title.get(t, t) for w in new.values() for t in (w.get('tags') or [])}),
        'newWatchesInBindings': sum(uid in bindings for uid in created),
        'newLastChecked': sum(bool(w.get('last_checked')) for w in new.values()),
        'baselinesMatchPayload': all((base / 'baseline' / (s + '.json')).is_file()
                                     and sha(base / 'baseline' / (s + '.json')) == sha(here / 'payload/baseline' / (s + '.json'))
                                     for s in meta['newSchools']),
        'readAt': time.time(), 'publicationApproved': False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('command', choices=['dry-run', 'stage', 'install', 'receipts', 'readback'])
    parser.add_argument('--base', default=str(DEFAULT_BASE))
    parser.add_argument('--here', default=str(HERE))
    parser.add_argument('--target')
    parser.add_argument('--approved-sha256')
    parser.add_argument('--authorization-b64', default='')
    args = parser.parse_args(argv)
    here, base = Path(args.here), Path(args.base)
    try:
        if args.command == 'stage':
            check(args.target and inside(Path(args.target).parent, base), '--target must be a folder in the monitor base')
            result = cmd_stage(here, args.target)
        elif args.command == 'receipts':
            result = cmd_receipts(here)
        else:
            c = monitor(base)
            if args.command == 'dry-run':
                result = cmd_dry_run(here, base, c)
            elif args.command == 'readback':
                result = cmd_readback(here, base, c)
            else:
                authorization = base64.b64decode(args.authorization_b64.encode()).decode('utf-8')
                with (base / 'collect.lock').open('w') as a, (base / 'review.lock').open('w') as b:
                    try:
                        fcntl.flock(a, fcntl.LOCK_EX | fcntl.LOCK_NB)
                        fcntl.flock(b, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    except BlockingIOError:
                        raise Refused('Monitor collect or review is running; retry when it has finished')
                    result = cmd_install(here, base, c, args.approved_sha256 or '', authorization)
    except Refused as error:
        print(json.dumps({'ok': False, 'refused': str(error)}), flush=True)
        return 3
    print(json.dumps(dict(result, ok=True), ensure_ascii=False), flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
