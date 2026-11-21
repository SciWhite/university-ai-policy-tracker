#!/usr/bin/env python3
"""Health watchdog for the routed UAPT web slot (docs/program-release.md §6.2).

Run once a minute by uapt-web-watchdog.timer (oneshot, root). Each run probes the slot that nginx
routes to (uapt-main-upstream.conf) on a cheap dynamic route over loopback. The slot is restarted
only after N consecutive probe failures, never while a lifecycle transaction is unfinished, the
release lock is held (a content or program release is running) or within the start-up grace, at most once per cooldown and a few times per day. Every restart (and
every suppressed one) leaves a receipt with the memory evidence taken just before it. Nothing is
sent anywhere else.

Background: on 2026-11-21 the slot stalled for 41 minutes at MemoryHigh (no swap, D state) and
every uncached request returned 504 until the memcg OOM killer fired at MemoryMax.
"""
import argparse, datetime, json, os, re, subprocess, sys, time, urllib.error, urllib.request
from pathlib import Path

UPSTREAM = Path('/etc/nginx/snippets/uapt-main-upstream.conf')
TRANSACTION = Path('/srv/uapt/operations/release-lifecycle/transaction.json')
RELEASE_LOCK = Path('/run/lock/uapt-release.lock')  # held by the controller and by content-release helpers
WEB_SLOTS = {3101: 'uapt-mcp-v6-candidate.service', 3102: 'uapt-mcp-v6-r2.service'}
STATE = Path('/run/uapt-web-watchdog/state.json')
RECEIPTS = Path('/srv/uapt/operations/web-watchdog')
PROBE_PATH = '/api/plugin/status'  # force-dynamic, no content reads: answers whenever the event loop runs
SITE_HOST = 'eduaipolicy.org'
DEFAULTS = {'timeout': 20.0, 'failures': 3, 'grace': 900, 'cooldown': 1800, 'daily_max': 3}
CGROUP_FILES = ('memory.current', 'memory.high', 'memory.max', 'memory.peak', 'memory.events', 'memory.pressure')


def now():
    return datetime.datetime.now(datetime.timezone.utc)


def routed_port(text):
    """The single 127.0.0.1 port in upstream uapt_next_backend."""
    block = re.search(r'upstream\s+uapt_next_backend\s*\{([^}]*)\}', text)
    ports = re.findall(r'server\s+127\.0\.0\.1:(\d+)', block.group(1)) if block else []
    if len(ports) != 1:
        raise ValueError('Expected exactly one routed web slot in uapt_next_backend, found ' + str(ports))
    return int(ports[0])


def unit_state(unit, run=subprocess.run):
    out = run(['systemctl', 'show', unit, '-p', 'ActiveState,SubState,MainPID,InvocationID,ActiveEnterTimestampMonotonic,ControlGroup'],
              capture_output=True, text=True, check=True).stdout
    return dict(line.split('=', 1) for line in out.splitlines() if '=' in line)


def uptime_seconds():
    return float(Path('/proc/uptime').read_text().split()[0])


def transaction_pending(path=TRANSACTION):
    try:
        return json.loads(path.read_text()).get('stage') not in ('complete', 'rolled_back')
    except FileNotFoundError:
        return False
    except (OSError, ValueError):
        return True  # unreadable journal: do not act


def lock_held(path=RELEASE_LOCK, locks_text=None):
    """Whether any process holds a lock on `path`, read from /proc/locks: the watchdog never takes
    the release lock itself, because every release action takes it with LOCK_NB and would fail."""
    try: info = os.stat(path)
    except FileNotFoundError: return False
    key = f'{os.major(info.st_dev):02x}:{os.minor(info.st_dev):02x}:{info.st_ino}'
    text = locks_text if locks_text is not None else Path('/proc/locks').read_text()
    return any(key in line.split() for line in text.splitlines())


def probe(port, timeout, opener=urllib.request.urlopen):
    request = urllib.request.Request(f'http://127.0.0.1:{port}{PROBE_PATH}',
                                     headers={'Host': SITE_HOST, 'X-Forwarded-Proto': 'https', 'User-Agent': 'uapt-web-watchdog'})
    started = time.monotonic()
    try:
        with opener(request, timeout=timeout) as response:
            response.read(4096)
            return {'ok': response.status == 200, 'status': response.status, 'seconds': round(time.monotonic() - started, 3)}
    except urllib.error.HTTPError as error:
        return {'ok': False, 'status': error.code, 'seconds': round(time.monotonic() - started, 3)}
    except Exception as error:  # timeout, refused, reset
        return {'ok': False, 'status': 0, 'error': type(error).__name__ + ': ' + str(error)[:200], 'seconds': round(time.monotonic() - started, 3)}


def evidence(state):
    """Memory and process facts just before a restart (read-only)."""
    facts = {'unit': state}
    group = Path('/sys/fs/cgroup') / state.get('ControlGroup', '').lstrip('/')
    for name in CGROUP_FILES:
        try: facts[name] = (group / name).read_text().strip()
        except OSError: pass
    try:
        stat = (group / 'memory.stat').read_text().splitlines()
        facts['memory.stat'] = {k: int(v) for k, v in (line.split() for line in stat) if k in ('anon', 'file', 'kernel', 'shmem', 'pgscan_direct', 'pgsteal_direct')}
    except (OSError, ValueError): pass
    pid = state.get('MainPID', '0')
    if pid.isdigit() and pid != '0':
        try:
            status = Path(f'/proc/{pid}/status').read_text()
            facts['process'] = {k: v.strip() for k, v in (line.split(':', 1) for line in status.splitlines() if ':' in line) if k in ('State', 'VmRSS', 'RssAnon', 'Threads')}
        except OSError: pass
    try: facts['MemAvailable'] = next(line.split(':', 1)[1].strip() for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable'))
    except (OSError, StopIteration): pass
    return facts


def load_state(path):
    try: return json.loads(path.read_text())
    except (OSError, ValueError): return {}


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name('.' + path.name + '.tmp')
    tmp.write_text(json.dumps(value, indent=2) + '\n')
    os.replace(tmp, path)


def append_event(event, receipts):
    receipts.mkdir(parents=True, exist_ok=True)
    log = receipts / 'events.jsonl'
    if log.exists() and log.stat().st_size > 1 << 20:  # bounded: keep the newest 2,000 events
        lines = log.read_text().splitlines()[-2000:]
        log.write_text('\n'.join(lines) + '\n')
    with log.open('a') as stream:
        stream.write(json.dumps(event, sort_keys=True) + '\n')


def decide(state, *, config, pending, unit, previous, at, uptime, locked=False):
    """Pure: what this run does with one probe result already in `state['probe']`.
    Returns (action, new_state). action: ok | skip:<why> | fail | restart | suppressed:<why>."""
    invocation = unit.get('InvocationID', '')
    record = dict(previous) if previous.get('invocation') == invocation else {'invocation': invocation, 'failures': 0}
    record['restarts'] = [t for t in previous.get('restarts', []) if at - datetime.datetime.fromisoformat(t) < datetime.timedelta(days=1)]
    if unit.get('ActiveState') != 'active':
        return 'skip:unit-not-active', {**record, 'failures': 0}
    if pending:
        return 'skip:lifecycle-transaction', {**record, 'failures': 0}
    if locked:
        return 'skip:release-lock-held', {**record, 'failures': 0}
    started = int(unit.get('ActiveEnterTimestampMonotonic', '0') or 0) / 1e6
    if started and uptime - started < config['grace']:
        return 'skip:start-up-grace', {**record, 'failures': 0}
    if state['probe']['ok']:
        return 'ok', {**record, 'failures': 0}
    record['failures'] = record.get('failures', 0) + 1
    if record['failures'] < config['failures']:
        return 'fail', record
    last = max(record['restarts'], default=None)
    if last and at - datetime.datetime.fromisoformat(last) < datetime.timedelta(seconds=config['cooldown']):
        return 'suppressed:cooldown', record
    if len(record['restarts']) >= config['daily_max']:
        return 'suppressed:daily-limit', record
    record['restarts'] = record['restarts'] + [at.isoformat()]
    record['failures'] = 0
    return 'restart', record


def main(argv=None, *, run=subprocess.run, opener=urllib.request.urlopen, state_path=STATE, receipts=RECEIPTS, upstream=UPSTREAM, transaction=TRANSACTION, release_lock=RELEASE_LOCK):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--dry-run', action='store_true', help='probe and report; never restart or write state')
    parser.add_argument('--timeout', type=float, default=DEFAULTS['timeout'])
    parser.add_argument('--failures', type=int, default=DEFAULTS['failures'], help='consecutive failed probes before a restart')
    parser.add_argument('--grace', type=int, default=DEFAULTS['grace'], help='seconds after a start in which nothing is restarted')
    parser.add_argument('--cooldown', type=int, default=DEFAULTS['cooldown'], help='seconds between two watchdog restarts')
    parser.add_argument('--daily-max', type=int, default=DEFAULTS['daily_max'], help='watchdog restarts per 24 h; then only receipts')
    args = parser.parse_args(argv)
    config = {'timeout': args.timeout, 'failures': max(1, args.failures), 'grace': args.grace, 'cooldown': args.cooldown, 'daily_max': args.daily_max}
    at = now()
    port = routed_port(Path(upstream).read_text())
    unit_name = WEB_SLOTS.get(port)
    if not unit_name: raise ValueError(f'Routed port {port} is not a fixed web slot')
    unit = unit_state(unit_name, run)
    result = probe(port, config['timeout'], opener)
    previous = load_state(state_path)
    action, record = decide({'probe': result}, config=config, pending=transaction_pending(Path(transaction)), unit=unit,
                            previous=previous, at=at, uptime=uptime_seconds(), locked=lock_held(Path(release_lock)))
    event = {'at': at.isoformat(), 'unit': unit_name, 'port': port, 'invocation': unit.get('InvocationID'), 'probe': result,
             'action': action, 'consecutiveFailures': record.get('failures', 0), 'config': config, 'dryRun': args.dry_run}
    if args.dry_run:
        print(json.dumps(event, indent=2)); return 0
    if action in ('restart',) or action.startswith('suppressed'):
        event['evidence'] = evidence(unit)
    if action == 'restart':
        receipt = receipts / ('restart-' + at.strftime('%Y%m%dT%H%M%SZ') + '.json')
        save_json(receipt, {**event, 'reason': f'{config["failures"]} consecutive failed probes of {PROBE_PATH} (timeout {config["timeout"]} s)'})
        done = run(['systemctl', 'restart', unit_name], capture_output=True, text=True)
        event['restart'] = {'exitCode': done.returncode, 'stderr': done.stderr[-500:], 'receipt': str(receipt)}
        after = unit_state(unit_name, run)
        record['invocation'] = after.get('InvocationID', '')
        save_json(receipt, {**event, 'after': after})
    if action != 'ok' and not action.startswith('skip') or previous.get('lastAction') not in (None, action):
        append_event({k: v for k, v in event.items() if k != 'config'}, receipts)
    save_json(state_path, {**record, 'lastAction': action, 'lastProbe': result, 'at': at.isoformat()})
    print(json.dumps({k: event[k] for k in ('at', 'unit', 'action', 'consecutiveFailures')}))
    return 1 if action == 'restart' and event['restart']['exitCode'] else 0


if __name__ == '__main__':
    try: sys.exit(main())
    except Exception as error:
        print('watchdog error: ' + str(error), file=sys.stderr); sys.exit(2)
